import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/core/env";

export const ACCESS_TOKEN_COOKIE = "mb_access_token";
export const REFRESH_TOKEN_COOKIE = "mb_refresh_token";

export type AuthTokenPayload = JwtPayload & {
  sub: string;
  role: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
  branchId?: string | null;
  email: string;
};

function signToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  secret: string,
  expiresIn: SignOptions["expiresIn"],
): string {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, secret, options);
}

export function createAccessToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
): string {
  return signToken(
    payload,
    env.jwtAccessSecret,
    (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as SignOptions["expiresIn"],
  );
}

export function createRefreshToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
): string {
  return signToken(
    payload,
    env.jwtRefreshSecret,
    (process.env.JWT_REFRESH_EXPIRES_IN ?? "30d") as SignOptions["expiresIn"],
  );
}

function verifyToken(token: string, secret: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, secret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): AuthTokenPayload | null {
  return verifyToken(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token: string): AuthTokenPayload | null {
  return verifyToken(token, env.jwtRefreshSecret);
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  const secure = env.appEnv !== "development";

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    return cookieToken;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.replace("Bearer ", "");
}
