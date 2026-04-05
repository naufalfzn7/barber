import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
  type AuthTokenPayload,
} from "@/server/core/auth";

export function getAuthenticatedPayload(
  request: NextRequest,
): AuthTokenPayload | null {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return verifyAccessToken(token);
}

export function requireRole(
  request: NextRequest,
  allowedRoles: Array<"MEMBER" | "ADMIN" | "SUPER_ADMIN">,
): AuthTokenPayload | NextResponse {
  const payload = getAuthenticatedPayload(request);

  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return payload;
}
