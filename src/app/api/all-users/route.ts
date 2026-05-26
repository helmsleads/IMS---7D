import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import { joinName, splitName } from "@/lib/api/all-users";
import type { AllUserType } from "@/lib/api/all-users";
import { sendUserInvitation, type InviteFailure } from "@/lib/server/invite-user";

function inviteErrorResponse(failure: InviteFailure, status = 500) {
  return NextResponse.json(
    {
      error: failure.error,
      details: failure.details,
      step: failure.step,
    },
    { status }
  );
}

async function verifyAdmin(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: callerUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerUser || callerUser.role !== "admin") return null;

  return user;
}

/** GET /api/all-users — unified staff + portal users */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const service = createServiceClient();
    const rows: Array<{
      id: string;
      type: AllUserType;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      role: string;
      client: string | null;
      client_id: string | null;
      client_user_id: string | null;
      active: boolean;
      created_at: string;
    }> = [];

    const { data: staffUsers, error: staffError } = await service
      .from("users")
      .select("id, name, email, role, active, created_at")
      .order("name");

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    for (const u of staffUsers || []) {
      const { first_name, last_name } = splitName(u.name);
      rows.push({
        id: u.id,
        type: "staff",
        email: u.email,
        first_name,
        last_name,
        phone: null,
        role: u.role,
        client: null,
        client_id: null,
        client_user_id: null,
        active: u.active,
        created_at: u.created_at,
      });
    }

    const { data: clientUsersData, error: cuError } = await service
      .from("client_users")
      .select(
        `
        id,
        user_id,
        client_id,
        role,
        is_primary,
        created_at,
        client:clients (id, company_name)
      `
      )
      .order("created_at", { ascending: false });

    if (cuError) {
      return NextResponse.json({ error: cuError.message }, { status: 500 });
    }

    const { data: profiles, error: profileError } = await service
      .from("user_profiles")
      .select("id, email, full_name, phone, created_at");

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    const portalMap = new Map<
      string,
      {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        role: string;
        clients: string[];
        client_id: string | null;
        client_user_id: string | null;
        created_at: string;
      }
    >();

    for (const cu of clientUsersData || []) {
      const profile = profileMap.get(cu.user_id);
      if (!profile) continue;

      const client = Array.isArray(cu.client) ? cu.client[0] : cu.client;
      if (!client) continue;

      const { first_name, last_name } = splitName(profile.full_name);
      const existing = portalMap.get(profile.id);

      if (!existing) {
        portalMap.set(profile.id, {
          id: profile.id,
          email: profile.email,
          first_name,
          last_name,
          phone: profile.phone,
          role: cu.role,
          clients: [client.company_name],
          client_id: cu.client_id,
          client_user_id: cu.id,
          created_at: profile.created_at,
        });
      } else {
        if (!existing.clients.includes(client.company_name)) {
          existing.clients.push(client.company_name);
        }
        if (cu.is_primary) {
          existing.client_id = cu.client_id;
          existing.client_user_id = cu.id;
          existing.role = cu.role;
        }
      }
    }

    for (const p of portalMap.values()) {
      rows.push({
        id: p.id,
        type: "client",
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        role: p.role,
        client: p.clients.join(", "),
        client_id: p.client_id,
        client_user_id: p.client_user_id,
        active: true,
        created_at: p.created_at,
      });
    }

    rows.sort((a, b) => {
      const typeOrder = a.type === b.type ? 0 : a.type === "staff" ? -1 : 1;
      if (typeOrder !== 0) return typeOrder;
      const nameA = `${a.first_name} ${a.last_name}`.trim() || a.email;
      const nameB = `${b.first_name} ${b.last_name}`.trim() || b.email;
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("GET all-users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST /api/all-users — invite / resend */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();

    if (body.action === "resend") {
      const { id, type, email } = body as {
        id: string;
        type: AllUserType;
        email: string;
      };

      if (!id || !type || !email?.trim()) {
        return NextResponse.json(
          { error: "id, type, and email are required" },
          { status: 400 }
        );
      }

      const service = createServiceClient();
      let fullName = "";
      let role: string | undefined;
      let clientId: string | undefined;

      if (type === "staff") {
        const { data: staff } = await service
          .from("users")
          .select("name, role")
          .eq("id", id)
          .maybeSingle();
        fullName = staff?.name || "";
        role = staff?.role;
      } else {
        const { data: profile } = await service
          .from("user_profiles")
          .select("full_name")
          .eq("id", id)
          .maybeSingle();
        fullName = profile?.full_name || "";
        const { data: access } = await service
          .from("client_users")
          .select("role, client_id")
          .eq("user_id", id)
          .order("is_primary", { ascending: false })
          .limit(1)
          .maybeSingle();
        role = access?.role;
        clientId = access?.client_id;
      }

      const result = await sendUserInvitation({
        email: email.trim().toLowerCase(),
        full_name: fullName || email.split("@")[0],
        user_type: type === "staff" ? "internal" : "portal",
        role,
        client_id: clientId,
        invited_by: admin.id,
        resend_user_id: id,
      });

      if (!result.success) {
        return inviteErrorResponse(result);
      }

      return NextResponse.json({
        message: "The invitation has been resent.",
      });
    }

    if (body.action !== "invite") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const {
      user_type,
      email,
      first_name,
      last_name,
      phone,
      role,
      client_id,
    } = body as {
      user_type: AllUserType;
      email: string;
      first_name: string;
      last_name: string;
      phone?: string;
      role: string;
      client_id?: string;
    };

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "You must enter an email address." },
        { status: 400 }
      );
    }

    if (!first_name?.trim()) {
      return NextResponse.json(
        { error: "First name is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const fullName = joinName(first_name, last_name);
    const service = createServiceClient();

    if (user_type === "staff") {
      const { data: existing } = await service
        .from("users")
        .select("id, active")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing?.active) {
        return NextResponse.json(
          { error: "Email Already Invited" },
          { status: 402 }
        );
      }

      if (existing && !existing.active) {
        await service
          .from("users")
          .update({
            name: fullName,
            role,
            active: true,
          })
          .eq("id", existing.id);
      }

      const inviteResult = await sendUserInvitation({
        email: normalizedEmail,
        full_name: fullName,
        user_type: "internal",
        role,
        invited_by: admin.id,
        resend_user_id: existing?.id,
      });

      if (!inviteResult.success) {
        return inviteErrorResponse(inviteResult);
      }

      const message = existing
        ? "User was reactivated with updated name and role. A new invitation email was sent."
        : "User was successfully created and the invitation email was sent.";

      return NextResponse.json({ message });
    }

    if (user_type === "client") {
      if (!client_id) {
        return NextResponse.json(
          { error: "Client is required for portal users." },
          { status: 400 }
        );
      }

      const { data: existingProfile } = await service
        .from("user_profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        const { data: access } = await service
          .from("client_users")
          .select("id")
          .eq("user_id", existingProfile.id)
          .eq("client_id", client_id)
          .maybeSingle();

        if (access) {
          return NextResponse.json(
            { error: "Email Already Invited" },
            { status: 402 }
          );
        }
      }

      const inviteResult = await sendUserInvitation({
        email: normalizedEmail,
        full_name: fullName,
        phone: phone || undefined,
        user_type: "portal",
        client_id,
        role,
        invited_by: admin.id,
        resend_user_id: existingProfile?.id,
      });

      if (!inviteResult.success) {
        return inviteErrorResponse(inviteResult);
      }

      return NextResponse.json({
        message:
          "User was successfully created and the invitation email was sent.",
      });
    }

    return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
  } catch (err) {
    console.error("POST all-users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** PATCH /api/all-users — update staff or portal user */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      type,
      email,
      first_name,
      last_name,
      phone,
      role,
      client_id,
      client_user_id,
    } = body;

    if (!id || !type || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fullName = joinName(first_name || "", last_name || "");
    const normalizedEmail = email.trim().toLowerCase();
    const service = createServiceClient();

    if (type === "staff") {
      const { error } = await service
        .from("users")
        .update({
          name: fullName,
          email: normalizedEmail,
          role,
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await service.auth.admin.updateUserById(id, {
        email: normalizedEmail,
        user_metadata: { full_name: fullName },
      });

      return NextResponse.json({ message: "User was successfully updated." });
    }

    if (type === "client") {
      const { error: profileError } = await service
        .from("user_profiles")
        .update({
          email: normalizedEmail,
          full_name: fullName,
          phone: phone || null,
        })
        .eq("id", id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      if (client_user_id && role) {
        await service
          .from("client_users")
          .update({ role })
          .eq("id", client_user_id);
      }

      if (client_id && client_user_id) {
        await service
          .from("client_users")
          .update({ client_id })
          .eq("id", client_user_id);
      }

      await service.auth.admin.updateUserById(id, {
        email: normalizedEmail,
        user_metadata: { full_name: fullName },
      });

      return NextResponse.json({ message: "User was successfully updated." });
    }

    return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
  } catch (err) {
    console.error("PATCH all-users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/all-users — deactivate staff or remove portal access */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, type } = body as { id: string; type: AllUserType };

    if (!id || !type) {
      return NextResponse.json({ error: "id and type are required" }, { status: 400 });
    }

    if (id === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    if (type === "staff") {
      const { error } = await service
        .from("users")
        .update({ active: false })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: "Staff user has been deactivated.",
      });
    }

    if (type === "client") {
      const { error } = await service
        .from("client_users")
        .delete()
        .eq("user_id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: "Portal user access has been removed.",
      });
    }

    return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
  } catch (err) {
    console.error("DELETE all-users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
