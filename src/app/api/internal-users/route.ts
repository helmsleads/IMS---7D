import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";

export async function POST(request: NextRequest) {
  try {
    // Verify the caller is an authenticated admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!callerUser || callerUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Name, email, password, and role are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Check if email already exists
    const { data: existingUser } = await serviceClient
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Create auth user via admin API (doesn't affect current session)
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create the internal user record
    const { data: newUser, error: userError } = await serviceClient
      .from("users")
      .insert({
        id: authData.user.id,
        name,
        email: email.toLowerCase(),
        role,
        active: true,
      })
      .select()
      .single();

    if (userError) {
      // Clean up the auth user if the record insert fails
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: userError.message || "Failed to create user record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: newUser });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
