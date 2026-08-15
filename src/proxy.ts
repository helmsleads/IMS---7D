import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import {
  SHOPIFY_APP_ENTRY_PATH,
} from "@/lib/shopify-embed";

// Routes that don't require authentication
const publicRoutes = [
  "/",
  "/login",
  "/client-login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/accept-invite",
  "/shopify/entry",
];

// Internal app routes (require staff authentication)
const internalRoutes = [
  "/dashboard",
  "/products",
  "/inventory",
  "/locations",
  "/inbound",
  "/outbound",
  "/clients",
  "/reports",
  "/settings",
];

// Portal routes (require client authentication)
const portalRoutes = ["/portal"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Static files like favicon.ico
  ) {
    return NextResponse.next();
  }

  // Legacy install: Shopify opens App URL with shop+hmac. Send to OAuth authorize
  // immediately (server-side) so install does not depend on client JS.
  if (
    (pathname === "/" || pathname === SHOPIFY_APP_ENTRY_PATH) &&
    request.nextUrl.searchParams.get("embedded") !== "1"
  ) {
    const shop = request.nextUrl.searchParams.get("shop") || "";
    const hasShopifyInstallParams =
      shop.includes("myshopify.com") &&
      (request.nextUrl.searchParams.has("hmac") ||
        request.nextUrl.searchParams.has("host"));
    if (hasShopifyInstallParams) {
      const begin = new URL(
        "/api/integrations/shopify/begin-install",
        request.url,
      );
      request.nextUrl.searchParams.forEach((value, key) => {
        begin.searchParams.set(key, value);
      });
      if (!begin.searchParams.get("app")) {
        begin.searchParams.set("app", "live");
      }
      return NextResponse.redirect(begin);
    }
  }

  // Only rewrite true Admin iframe embeds (embedded=1).
  if (
    pathname !== SHOPIFY_APP_ENTRY_PATH &&
    request.nextUrl.searchParams.get("embedded") === "1"
  ) {
    const entry = new URL(SHOPIFY_APP_ENTRY_PATH, request.url);
    const shop = request.nextUrl.searchParams.get("shop");
    if (shop) entry.searchParams.set("shop", shop);
    return NextResponse.redirect(entry);
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Create Supabase client and check session
  const { supabase, response } = createMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if route is an internal route
  const isInternalRoute = internalRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Check if route is a portal route
  const isPortalRoute = portalRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Handle internal routes
  if (isInternalRoute) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: staffData } = await supabase
      .from("users")
      .select("id, active")
      .eq("id", user.id)
      .eq("active", true)
      .single();

    if (!staffData) {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }

    return response;
  }

  // Handle portal routes
  if (isPortalRoute) {
    if (!user) {
      const loginUrl = new URL("/client-login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated, allow access
    // Note: Client-specific validation (checking clients table) is still done client-side
    // as it requires database queries that are better handled in the app layer
    return response;
  }

  // For any other routes, allow access
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
