import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateSuperadminData } from "@/server/core/revalidate";
import { superadminService } from "@/server/services/superadminService";

// Service photos are owner/super-admin only.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { serviceId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await superadminService.setServiceImage({
      serviceId,
      file: { buffer, type: file.type, size: file.size },
    });
    revalidateSuperadminData();

    return NextResponse.json(
      { message: "Foto layanan diperbarui", result },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to upload service image";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { serviceId } = await context.params;
    const result = await superadminService.removeServiceImage(serviceId);
    revalidateSuperadminData();

    return NextResponse.json(
      { message: "Foto layanan dihapus", result },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove service image";
    return NextResponse.json({ message }, { status: 400 });
  }
}
