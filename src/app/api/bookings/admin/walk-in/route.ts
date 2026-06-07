import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";
import { revalidateBookingData } from "@/server/core/revalidate";

function resolveBranchId(
  auth: { role: "MEMBER" | "ADMIN" | "SUPER_ADMIN"; branchId?: string | null },
  requestedBranchId?: string | null,
): { branchId?: string; error?: NextResponse } {
  if (auth.role === "ADMIN") {
    if (!auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Admin does not have branch assignment" },
          { status: 400 },
        ),
      };
    }

    if (requestedBranchId && requestedBranchId !== auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Forbidden for other branch" },
          { status: 403 },
        ),
      };
    }

    return { branchId: auth.branchId };
  }

  if (!requestedBranchId) {
    return {
      error: NextResponse.json(
        { message: "branchId is required for super admin" },
        { status: 400 },
      ),
    };
  }

  return { branchId: requestedBranchId };
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      branchId?: string;
      serviceId?: string;
      scheduledStart?: string;
      walkInName?: string;
      walkInPhone?: string;
      notes?: string;
    };

    if (!body.serviceId || !body.scheduledStart || !body.walkInName) {
      return NextResponse.json(
        { message: "serviceId, scheduledStart, and walkInName are required" },
        { status: 400 },
      );
    }

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const booking = await bookingService.createWalkInBooking({
      createdById: auth.sub,
      branchId: scope.branchId!,
      serviceId: body.serviceId,
      scheduledStart: body.scheduledStart,
      walkInName: body.walkInName,
      walkInPhone: body.walkInPhone,
      notes: body.notes,
    });
    revalidateBookingData();

    return NextResponse.json(
      {
        message: "Walk-in booking created",
        booking,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create walk-in booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
