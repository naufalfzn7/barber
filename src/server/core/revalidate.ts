import { revalidatePath, revalidateTag } from "next/cache";

const ADMIN_PATHS = ["/admin/dashboard", "/admin/reservasi", "/admin/stok", "/admin/keuangan"];
const SUPERADMIN_PATHS = [
  "/superadmin/dashboard",
  "/superadmin/cabang",
  "/superadmin/barberman",
  "/superadmin/layanan",
  "/superadmin/admin",
  "/superadmin/pengaturan",
  "/superadmin/laporan",
];
const USER_PATHS = ["/", "/reservasi", "/profile", "/services"];

export function revalidateBookingData() {
  revalidateTag("bookings", "max");
  revalidateTag("payments", "max");
  for (const path of [...ADMIN_PATHS, ...SUPERADMIN_PATHS, ...USER_PATHS]) {
    revalidatePath(path);
  }
}

export function revalidateInventoryData() {
  revalidateTag("inventory", "max");
  revalidateTag("bookings", "max");
  for (const path of [
    "/admin/stok",
    "/admin/reservasi",
    "/superadmin/dashboard",
    "/services",
  ]) {
    revalidatePath(path);
  }
}

export function revalidateSuperadminData() {
  revalidateTag("superadmin", "max");
  revalidateTag("catalog", "max");
  for (const path of SUPERADMIN_PATHS) {
    revalidatePath(path);
  }
  for (const path of ["/reservasi", "/services", "/surakarta", "/yogyakarta"]) {
    revalidatePath(path);
  }
}
