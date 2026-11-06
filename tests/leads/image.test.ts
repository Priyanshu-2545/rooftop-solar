import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkAndReencode, MAX_UPLOAD_BYTES, sniffMime, UploadError } from "@/lib/storage/image";

describe("upload hardening", () => {
  it("accepts a real PNG and re-encodes it as JPEG", async () => {
    const out = await checkAndReencode(readFileSync("samples/bills/bill-good-340.png"));
    expect(out).toMatchObject({ mime: "image/jpeg", mimeIn: "image/png" });
    expect(sniffMime(out.data)).toBe("image/jpeg");
  });
  it("rejects a forged file (text pretending to be an image)", async () => {
    await expect(checkAndReencode(Buffer.from("<script>alert(1)</script>"))).rejects.toMatchObject({ code: "bad_type" });
  });
  it("rejects an SVG and a PDF by magic bytes", async () => {
    await expect(checkAndReencode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toBeInstanceOf(UploadError);
    await expect(checkAndReencode(Buffer.from("%PDF-1.4 ..."))).rejects.toMatchObject({ code: "bad_type" });
  });
  it("rejects empty and oversized files", async () => {
    await expect(checkAndReencode(Buffer.alloc(0))).rejects.toMatchObject({ code: "empty" });
    await expect(checkAndReencode(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({ code: "too_large" });
  });
  it("rejects a corrupt image that has valid magic bytes", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really a jpeg")]);
    await expect(checkAndReencode(fake)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("strips EXIF/GPS metadata and downsizes large images", async () => {
    const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#fff" } })
      .jpeg().withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "21/1 9/1 0/1" } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeTruthy();
    const out = await checkAndReencode(withExif);
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1600);
  });
});
