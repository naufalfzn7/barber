import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "mb_access_token";

type MiddlewareJwtPayload = {
  role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
};

function decodePayload(token: string): MiddlewareJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payloadJson = atob(padded);
    return JSON.parse(payloadJson) as MiddlewareJwtPayload;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const next = encodeURIComponent(
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = accessToken ? decodePayload(accessToken) : null;

  if (pathname.startsWith("/admin")) {
    if (!payload) {
      return redirectToLogin(request);
    }

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/superadmin")) {
    if (!payload) {
      return redirectToLogin(request);
    }

    if (payload.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/superadmin/:path*"],
};
