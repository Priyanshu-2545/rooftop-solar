// Upload hardening: size cap, magic-byte check (never trust the declared type), then RE-ENCODE with sharp.
// Re-encoding strips EXIF/GPS, applies orientation, and downscales (good for 3G and for privacy).
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type UploadErrorCode = "empty" | "too_large" | "bad_type" | "corrupt";
export class UploadError extends Error {
  constructor(public code: UploadErrorCode) {
    super(`Upload rejected: ${code}`);
    this.name = "UploadError";
  }
}

export function sniffMime(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function checkAndReencode(original: Buffer): Promise<{ data: Buffer; mime: "image/jpeg"; mimeIn: string }> {
  if (original.length === 0) throw new UploadError("empty");
  if (original.length > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  const mimeIn = sniffMime(original);
  if (!mimeIn) throw new UploadError("bad_type");
  try {
    const data = await sharp(original, { limitInputPixels: 60_000_000 })
      .rotate() // honour EXIF orientation, then metadata is dropped by default
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { data, mime: "image/jpeg", mimeIn };
  } catch {
    throw new UploadError("corrupt");
  }
}
