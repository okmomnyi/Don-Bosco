import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/session";

/**
 * Route protection (Edge runtime — only `jose` is used, no DB / bcrypt here):
 *   - /admin/login            → public (the admin sign-in page)
 *   - /admin*                 → admin role only, else redirect to /admin/login
 *   - /portal/dashboard*      → any signed-in user, else redirect to /portal
 *   - /portal/change-password → any signed-in user, else redirect to /portal
 *
 * Fine-grained checks (e.g. must_change_password, member-vs-admin landing)
 * happen in the pages/route handlers, which can read the database.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);

  // --- Admin area ---
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      // Already signed in as admin? Skip the login page.
      if (session?.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      return NextResponse.next();
    }
    if (session?.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  // --- Member portal (protected sub-routes) ---
  if (
    pathname.startsWith("/portal/dashboard") ||
    pathname.startsWith("/portal/change-password")
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/dashboard/:path*", "/portal/change-password"],
};
