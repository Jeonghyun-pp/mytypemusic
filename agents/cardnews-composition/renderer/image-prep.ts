import sharp from "sharp";
import { readFile } from "node:fs/promises";

/**
 * Pre-process a hero/background image for Satori rendering.
 *
 * Replaces:
 *  - file:// URLs → base64 data URI
 *  - CSS filter: brightness() → sharp modulate
 *  - CSS object-fit: cover → sharp resize with cover fit
 */
export async function prepareImage(params: {
  localPath: string;
  targetW?: number;
  targetH?: number;
  brightness?: number; // 0.0-1.0, e.g. 0.62
}): Promise<Buffer> {
  let pipeline = sharp(params.localPath);

  if (params.targetW && params.targetH) {
    pipeline = pipeline.resize(params.targetW, params.targetH, {
      fit: "cover",
      position: "centre",
    });
  }

  if (params.brightness !== undefined && params.brightness < 1.0) {
    pipeline = pipeline.modulate({ brightness: params.brightness });
  }

  return pipeline.png().toBuffer();
}

/**
 * Read a local image file and return as PNG buffer (no resize/darken).
 */
export async function readImageBuffer(localPath: string): Promise<Buffer> {
  return readFile(localPath);
}

/**
 * Convert a Buffer to a data URI string for embedding in Satori JSX.
 */
export function bufferToDataUri(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
