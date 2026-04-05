import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/core/env";
import { paymentService } from "@/server/services/paymentService";

type RawXenditWebhookPayload = {
  external_id?: string;
  reference_id?: string;
  status?: string;
  paid_at?: string;
  data?: {
    external_id?: string;
    reference_id?: string;
    status?: string;
    paid_at?: string;
    created?: string;
  };
};

function normalizeToken(value?: string | null): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const callbackToken = normalizeToken(
      request.headers.get("x-callback-token"),
    );
    const expectedToken = normalizeToken(env.xenditWebhookToken);
    if (expectedToken && callbackToken !== expectedToken) {
      return NextResponse.json(
        { message: "Invalid webhook token" },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as RawXenditWebhookPayload;
    const normalizedPayload = {
      external_id: payload.external_id ?? payload.data?.external_id,
      reference_id: payload.reference_id ?? payload.data?.reference_id,
      status: payload.status ?? payload.data?.status,
      paid_at:
        payload.paid_at ?? payload.data?.paid_at ?? payload.data?.created,
    };

    const result = await paymentService.handleXenditWebhook(normalizedPayload);

    return NextResponse.json(
      {
        message: "Webhook processed",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process webhook";

    if (message === "Payment reference not found") {
      return NextResponse.json(
        {
          message: "Webhook acknowledged",
          ignored: true,
          reason: message,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ message }, { status: 400 });
  }
}
