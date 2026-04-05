import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/server/core/auth";

export async function POST() {
  const response = NextResponse.json(
    { message: "Logout successful" },
    { status: 200 },
  );
  clearAuthCookies(response);
  return response;
}
