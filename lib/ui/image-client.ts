"use client";
// Browser-side: downscale big phone photos before upload (saves 3G data; server still re-encodes and enforces 5 MB).
const OK = ["image/jpeg", "image/png", "image/webp"];
const SKIP_BELOW = 1_500_000;

export type PrepResult = { file: File } | { error: "type" | "size" };

export async function prepareImage(file: File): Promise<PrepResult> {
  const typeOk = OK.includes(file.type);
  if (typeOk && file.size <= SKIP_BELOW) return { file };
  try {
    const bmp = await createImageBitmap(file); // HEIC works here on Safari; elsewhere it throws
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return { error: "type" };
    if (blob.size > 5 * 1024 * 1024) return { error: "size" };
    return { file: new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) };
  } catch {
    return { error: typeOk ? "size" : "type" };
  }
}
