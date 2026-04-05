import { NextResponse, type NextRequest } from "next/server";
import { bookingService } from "@/server/services/bookingService";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { message: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  try {
    const canceledCount = await bookingService.runPaymentPendingMaintenance();
    return NextResponse.json(
      {
        message: "Payment pending maintenance executed",
        canceledCount,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Maintenance execution failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
