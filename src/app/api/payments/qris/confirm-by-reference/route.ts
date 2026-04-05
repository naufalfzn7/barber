import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { paymentService } from "@/server/services/paymentService";
import { env } from "@/server/core/env";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const isProduction =
    process.env.NODE_ENV === "production" ||
    env.appEnv.toLowerCase() === "production";

  if (isProduction) {
    return NextResponse.json(
      {
        message:
          "Manual QRIS confirmation is disabled in production. Use official webhook callback.",
      },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      externalRef?: string;
    };

    if (!body.externalRef?.trim()) {
      return NextResponse.json(
        { message: "externalRef is required" },
        { status: 400 },
      );
    }

    const result = await paymentService.confirmQrisByReference({
      externalRef: body.externalRef,
      actor: {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    });

    return NextResponse.json(
      {
        message:
          "Pembayaran QRIS terkonfirmasi. Booking otomatis menjadi COMPLETED.",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to confirm QRIS payment by reference";
    return NextResponse.json({ message }, { status: 400 });
  }
}
