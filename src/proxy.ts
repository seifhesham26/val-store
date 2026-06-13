import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js Proxy for Route Protection
 *
 * Provides first-line defense for admin routes.
 * This runs at the edge before the page even loads.
 *
 * Note: We check for session cookie existence here (fast, no HTTP calls).
 * Full session validation and role checks happen in tRPC/page layer.
 *
 * Public routes: /, /collections/*, /products/* (customer-facing)
 * Protected routes: /admin/* (admin only)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes require authentication
  if (pathname.startsWith("/admin")) {
    // Check for Better Auth session cookie (avoids HTTP call that can deadlock).
    // Use Better Auth's helper so the cookie name matches regardless of the
    // secure prefix (e.g. "__Secure-better-auth.session_token" over HTTPS).
    const sessionCookie = getSessionCookie(request);

    // No session cookie = redirect to login
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }

    // Session cookie exists - allow through (full validation in page/tRPC)
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure which routes the proxy applies to
export const config = {
  matcher: [
    // Admin routes only - EXCLUDE api routes to prevent deadlock
    "/admin/:path*",
  ],
};
