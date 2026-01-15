import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/client-login", "/forgot-password", "/reset-password"];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Static files like favicon.ico
  ) {
    return NextResponse.next();
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

    // User is authenticated, allow access
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
