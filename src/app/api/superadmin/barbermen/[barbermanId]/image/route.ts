import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateSuperadminData } from "@/server/core/revalidate";
import { superadminService } from "@/server/services/superadminService";

// Barberman photos are owner/super-admin only.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ barbermanId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { barbermanId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await superadminService.setBarbermanImage({
      barbermanId,
      file: { buffer, type: file.type, size: file.size },
    });
    revalidateSuperadminData();

    return NextResponse.json(
      { message: "Foto barberman diperbarui", result },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to upload barberman image";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ barbermanId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { barbermanId } = await context.params;
    const result = await superadminService.removeBarbermanImage(barbermanId);
    revalidateSuperadminData();

    return NextResponse.json(
      { message: "Foto barberman dihapus", result },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove barberman image";
    return NextResponse.json({ message }, { status: 400 });
  }
}
