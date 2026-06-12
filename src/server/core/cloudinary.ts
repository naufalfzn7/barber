import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "@/server/core/env";

// The SDK auto-configures from the CLOUDINARY_URL env var. We force `secure`
// so delivery URLs are always HTTPS (required by next/image remotePatterns).
let configured = false;

function ensureConfigured(): void {
  if (configured) {
    return;
  }
  if (!env.cloudinaryUrl) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL in the environment.",
    );
  }
  cloudinary.config({ secure: true });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(env.cloudinaryUrl);
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function assertValidImage(file: { type: string; size: number }): void {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("File harus berupa gambar JPG, PNG, WEBP, atau AVIF");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran gambar maksimal 5 MB");
  }
}

export type UploadedImage = {
  url: string;
  publicId: string;
};

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<UploadedImage> {
  ensureConfigured();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: true,
        // Normalize on upload to keep delivery small and consistent.
        transformation: [
          { width: 1024, height: 1024, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(uploaded);
      },
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId) {
    return;
  }
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch {
    // Best-effort cleanup: never block the request because the old asset
    // could not be removed (it may already be gone).
  }
}
