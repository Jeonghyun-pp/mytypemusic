import path from "node:path";

/** Zero-padded slide HTML filename: slide_01.html */
export function slideHtmlName(index: number): string {
  return `slide_${String(index).padStart(2, "0")}.html`;
}

/** Zero-padded slide PNG filename: slide_01.png */
export function slidePngName(index: number): string {
  return `slide_${String(index).padStart(2, "0")}.png`;
}

/** Resolve absolute paths for a slide's HTML & PNG in the output directory */
export function resolveOutputPaths(
  outDir: string,
  slideIndex: number
): { html: string; png: string } {
  return {
    html: path.resolve(outDir, slideHtmlName(slideIndex)),
    png: path.resolve(outDir, slidePngName(slideIndex)),
  };
}

/** Path to caption.txt in output directory */
export function captionPath(outDir: string): string {
  return path.resolve(outDir, "caption.txt");
}

/** Path to layout_manifest.json in output directory */
export function manifestPath(outDir: string): string {
  return path.resolve(outDir, "layout_manifest.json");
}

/**
 * Resolve a local image path relative to the validated-post.json location.
 * If the path is already absolute, return it as-is.
 */
export function resolveLocalImagePath(
  localPath: string,
  inputJsonDir: string
): string {
  if (path.isAbsolute(localPath)) return localPath;
  return path.resolve(inputJsonDir, localPath);
}
