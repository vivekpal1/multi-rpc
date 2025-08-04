import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

// Initialize Privy client only if credentials are available
const privy = process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    )
  : null;

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/api/rpc",
  "/api/apikeys",
  "/api/usage",
  "/api/user",
  "/api/subscription",
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = ["/auth", "/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Create response with security headers
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.includes(pathname);

  // Get token from Authorization header or cookie
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.cookies.get("privy-token")?.value;

  if (isProtectedRoute) {
    // If Privy is not configured, skip authentication
    if (!privy) {
      console.warn("Authentication not configured - allowing access for development");
      return response;
    }
    
    if (!token) {
      // API routes return 401, web routes redirect to auth
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth", request.url));
    }

    try {
      // Verify the token
      const claims = await privy.verifyAuthToken(token);
      if (!claims) {
        if (pathname.startsWith("/api")) {
          return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/auth", request.url));
      }

      // Add user ID to headers for API routes
      if (pathname.startsWith("/api")) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", claims.userId);
        requestHeaders.set("x-request-id", requestId);
        
        const apiResponse = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        
        // Copy security headers
        response.headers.forEach((value, key) => {
          apiResponse.headers.set(key, value);
        });
        
        return apiResponse;
      }
    } catch (error) {
      console.error("Token verification error:", error);
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && token && privy) {
    try {
      const claims = await privy.verifyAuthToken(token);
      if (claims) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      // Invalid token, let them access auth page
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth/privy (auth endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth/privy).*)",
  ],
};