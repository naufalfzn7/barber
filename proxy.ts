import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "mb_access_token";
const REFRESH_TOKEN_COOKIE = "mb_refresh_token";
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15;

type ProxyJwtPayload = {
  sub?: string;
  role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
  branchId?: string | null;
  email?: string;
  exp?: number;
};

function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="), "base64");
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifyPayload(token: string, secret: string | undefined): ProxyJwtPayload | null {
  if (!secret) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") {
      return null;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const actualSignature = base64UrlDecode(signature);

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as ProxyJwtPayload;

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function verifyAccessPayload(token: string): ProxyJwtPayload | null {
  return verifyPayload(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshPayload(token: string): ProxyJwtPayload | null {
  return verifyPayload(token, process.env.JWT_REFRESH_SECRET);
}

function createAccessToken(payload: ProxyJwtPayload): string | null {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || !payload.sub || !payload.role || !payload.email) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      branchId: payload.branchId ?? null,
      iat: now,
      exp: now + ACCESS_TOKEN_MAX_AGE_SECONDS,
    }),
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();

  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

function setAccessCookie(response: NextResponse, token: string): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: (process.env.APP_ENV ?? "development") !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

function redirectToLogin(request: NextRequest): NextResponse {
  const next = encodeURIComponent(
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let payload = accessToken ? verifyAccessPayload(accessToken) : null;
  let nextResponse: NextResponse | null = null;

  if (!payload) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const refreshPayload = refreshToken ? verifyRefreshPayload(refreshToken) : null;
    const freshAccessToken = refreshPayload ? createAccessToken(refreshPayload) : null;

    if (refreshPayload && freshAccessToken) {
      payload = refreshPayload;
      nextResponse = NextResponse.next();
      setAccessCookie(nextResponse, freshAccessToken);
    }
  }

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

  return nextResponse ?? NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/superadmin/:path*"],
};
