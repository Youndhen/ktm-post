export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Cloudinary free-plan image limit

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type UploadValidation =
  | { ok: true }
  | { ok: false; status: 413 | 415; error: string };

export function validateUpload(file: { size: number; type: string }): UploadValidation {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      status: 415,
      error: "Unsupported file type. Upload a JPEG, PNG, WebP, GIF or AVIF image.",
    };
  }
  return { ok: true };
}
