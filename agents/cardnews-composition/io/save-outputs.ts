import fs from "node:fs/promises";
import { captionPath, manifestPath } from "./paths.js";
import type { LayoutManifest } from "../types.js";

/** Ensure a directory exists, creating it recursively if needed */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Write caption.txt and return its absolute path */
export async function saveCaption(
  outDir: string,
  captionText: string
): Promise<string> {
  const p = captionPath(outDir);
  await fs.writeFile(p, captionText, "utf-8");
  return p;
}

/** Write layout_manifest.json and return its absolute path */
export async function saveManifest(
  outDir: string,
  manifest: LayoutManifest
): Promise<string> {
  const p = manifestPath(outDir);
  await fs.writeFile(p, JSON.stringify(manifest, null, 2), "utf-8");
  return p;
}

/** Write an HTML slide file */
export async function saveHtml(
  htmlPath: string,
  htmlContent: string
): Promise<void> {
  await fs.writeFile(htmlPath, htmlContent, "utf-8");
}

/** Write any JSON data to a file path */
export async function saveJson(
  filePath: string,
  data: unknown
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
