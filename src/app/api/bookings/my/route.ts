import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const bookings = await bookingService.memberHistory(auth.sub);
  return NextResponse.json({ bookings }, { status: 200 });
}
