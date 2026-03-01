/**
 * Layer Compositor — renders a stack of layers into a single SVG document.
 *
 * Text layers use Satori for Korean text wrapping (per-layer, parallel).
 * Image/Shape/SVG-path layers generate direct SVG elements.
 * All layers are composited by zIndex into a final SVG.
 *
 * Output: SVG string ready for resvg-js → PNG.
 */
import satori from "satori";
import { loadFontsForMood } from "./fonts";
import type { FontMood } from "./fonts";
import {
  buildDropShadowFilter,
  buildGaussianBlurFilter,
} from "./svgFilters";

// ── Layer types (duplicated minimal interface to avoid cross-package import) ──

interface LayerShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

interface LayerBase {
  id: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  blendMode: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  shadow?: LayerShadow;
  blur?: number;
}

interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  fontFamily?: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  curvedPath?: string;
}

interface ImageLayer extends LayerBase {
  kind: "image";
  src: string;
  objectFit: "cover" | "contain" | "fill";
  borderRadius: number;
}

interface ShapeLayer extends LayerBase {
  kind: "shape";
  shapeType: "rect" | "circle" | "line" | "polygon";
  fill: string;
  stroke?: string;
  strokeWidth: number;
  borderRadius: number;
}

interface SvgPathLayer extends LayerBase {
  kind: "svg-path";
  pathData: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

type Layer = TextLayer | ImageLayer | ShapeLayer | SvgPathLayer;

// ── SVG helpers ──────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the transform attribute for a layer.
 * Rotation and scale pivot around the layer's center.
 */
function layerTransform(layer: LayerBase): string {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const parts: string[] = [];

  if (layer.rotation !== 0 || layer.scale !== 1) {
    parts.push(`translate(${String(cx)},${String(cy)})`);
    if (layer.rotation !== 0) parts.push(`rotate(${String(layer.rotation)})`);
    if (layer.scale !== 1) parts.push(`scale(${String(layer.scale)})`);
    parts.push(`translate(${String(-cx)},${String(-cy)})`);
  }

  return parts.join(" ");
}

// ── Per-layer SVG renderers ──────────────────────────────

async function renderTextLayer(
  layer: TextLayer,
  fontMood: FontMood,
): Promise<string> {
  // Handle curved text path
  if (layer.curvedPath) {
    const pathId = `curve-${layer.id}`;
    return [
      `<defs><path id="${pathId}" d="${escapeXml(layer.curvedPath)}" fill="none"/></defs>`,
      `<text`,
      `  font-family="${escapeXml(layer.fontFamily ?? "Pretendard")}"`,
      `  font-size="${String(layer.fontSize)}"`,
      `  font-weight="${String(layer.fontWeight)}"`,
      `  fill="${escapeXml(layer.color)}"`,
      `  letter-spacing="${String(layer.letterSpacing)}"`,
      `>`,
      `  <textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(layer.text)}</textPath>`,
      `</text>`,
    ].join("\n");
  }

  // Normal text: use Satori for Korean text wrapping
  const fonts = await loadFontsForMood(fontMood);

  const html = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: layer.width,
        height: layer.height,
        fontFamily: layer.fontFamily ?? "Pretendard",
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        color: layer.color,
        textAlign: layer.textAlign,
        lineHeight: layer.lineHeight,
        letterSpacing: `${String(layer.letterSpacing)}px`,
        wordBreak: "keep-all",
        overflow: "hidden",
      },
      children: [layer.text],
    },
  };

  const svg = await satori(html as Parameters<typeof satori>[0], {
    width: layer.width,
    height: layer.height,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"],
  });

  // Extract inner content from the Satori SVG (strip the outer <svg> wrapper)
  const innerStart = svg.indexOf(">") + 1;
  const innerEnd = svg.lastIndexOf("</svg>");
  if (innerStart <= 0 || innerEnd < 0) return svg;
  return svg.slice(innerStart, innerEnd);
}

function renderImageLayer(layer: ImageLayer): string {
  const parts: string[] = [];

  if (layer.borderRadius > 0) {
    const clipId = `clip-${layer.id}`;
    parts.push(
      `<defs><clipPath id="${clipId}">`,
      `  <rect x="${String(layer.x)}" y="${String(layer.y)}" width="${String(layer.width)}" height="${String(layer.height)}" rx="${String(layer.borderRadius)}"/>`,
      `</clipPath></defs>`,
    );
    parts.push(
      `<image href="${escapeXml(layer.src)}" x="${String(layer.x)}" y="${String(layer.y)}" width="${String(layer.width)}" height="${String(layer.height)}" preserveAspectRatio="${layer.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}" clip-path="url(#${clipId})"/>`,
    );
  } else {
    parts.push(
      `<image href="${escapeXml(layer.src)}" x="${String(layer.x)}" y="${String(layer.y)}" width="${String(layer.width)}" height="${String(layer.height)}" preserveAspectRatio="${layer.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"/>`,
    );
  }

  return parts.join("\n");
}

function renderShapeLayer(layer: ShapeLayer): string {
  const strokeAttr = layer.stroke
    ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${String(layer.strokeWidth)}"`
    : "";

  switch (layer.shapeType) {
    case "circle": {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      const rx = layer.width / 2;
      const ry = layer.height / 2;
      return `<ellipse cx="${String(cx)}" cy="${String(cy)}" rx="${String(rx)}" ry="${String(ry)}" fill="${escapeXml(layer.fill)}"${strokeAttr}/>`;
    }
    case "line":
      return `<line x1="${String(layer.x)}" y1="${String(layer.y)}" x2="${String(layer.x + layer.width)}" y2="${String(layer.y + layer.height)}" stroke="${escapeXml(layer.stroke ?? layer.fill)}" stroke-width="${String(layer.strokeWidth || 2)}"/>`;
    case "polygon": {
      // Default: triangle
      const x = layer.x;
      const y = layer.y;
      const w = layer.width;
      const h = layer.height;
      const points = `${String(x + w / 2)},${String(y)} ${String(x + w)},${String(y + h)} ${String(x)},${String(y + h)}`;
      return `<polygon points="${points}" fill="${escapeXml(layer.fill)}"${strokeAttr}/>`;
    }
    case "rect":
    default:
      return `<rect x="${String(layer.x)}" y="${String(layer.y)}" width="${String(layer.width)}" height="${String(layer.height)}" rx="${String(layer.borderRadius)}" fill="${escapeXml(layer.fill)}"${strokeAttr}/>`;
  }
}

function renderSvgPathLayer(layer: SvgPathLayer): string {
  return `<path d="${escapeXml(layer.pathData)}" fill="${escapeXml(layer.fill)}" stroke="${escapeXml(layer.stroke)}" stroke-width="${String(layer.strokeWidth)}" transform="translate(${String(layer.x)},${String(layer.y)})"/>`;
}

// ── Main compositor ──────────────────────────────────────

export interface ComposeOptions {
  width: number;
  height: number;
  background?: string;
  fontMood?: FontMood;
}

/**
 * Compose an array of layers into a single SVG string.
 * Text layers are rendered via Satori in parallel.
 */
export async function composeLayers(
  layers: Layer[],
  options: ComposeOptions,
): Promise<string> {
  const { width, height, background = "#FFFFFF", fontMood = "bold-display" } = options;

  // Sort by zIndex (ascending)
  const sorted = [...layers]
    .filter((l) => l.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Collect filter defs
  const filterDefs: string[] = [];

  // Render each layer in parallel where possible
  const rendered = await Promise.all(
    sorted.map(async (layer) => {
      let svgContent: string;

      switch (layer.kind) {
        case "text":
          svgContent = await renderTextLayer(layer, fontMood);
          break;
        case "image":
          svgContent = renderImageLayer(layer);
          break;
        case "shape":
          svgContent = renderShapeLayer(layer);
          break;
        case "svg-path":
          svgContent = renderSvgPathLayer(layer);
          break;
        default:
          return "";
      }

      // Build per-layer filter defs (combine shadow+blur into single filter if both)
      let filterId: string | undefined;
      const hasShadow = !!layer.shadow;
      const hasBlur = layer.blur != null && layer.blur > 0;

      if (hasShadow && hasBlur) {
        const fid = `fx-${layer.id}`;
        const { offsetX, offsetY, blur: sb, color } = layer.shadow!;
        filterDefs.push([
          `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">`,
          `  <feGaussianBlur in="SourceGraphic" stdDeviation="${String(layer.blur)}" result="blurred"/>`,
          `  <feDropShadow dx="${String(offsetX)}" dy="${String(offsetY)}" stdDeviation="${String(sb)}" flood-color="${escapeXml(color)}" flood-opacity="1"/>`,
          `</filter>`,
        ].join("\n"));
        filterId = fid;
      } else if (hasShadow) {
        const fid = `shadow-${layer.id}`;
        filterDefs.push(buildDropShadowFilter(fid, layer.shadow!));
        filterId = fid;
      } else if (hasBlur) {
        const fid = `blur-${layer.id}`;
        filterDefs.push(buildGaussianBlurFilter(fid, { stdDeviation: layer.blur! }));
        filterId = fid;
      }

      // Build <g> wrapper with transform, opacity, blend mode, filter
      const transform = layerTransform(layer);
      const gAttrs: string[] = [];
      if (transform) gAttrs.push(`transform="${transform}"`);
      if (layer.opacity < 1) gAttrs.push(`opacity="${String(layer.opacity)}"`);
      if (layer.blendMode !== "normal") gAttrs.push(`style="mix-blend-mode:${layer.blendMode}"`);
      if (filterId) gAttrs.push(`filter="url(#${filterId})"`);

      // For text layers without curvedPath, we need to position via a nested SVG
      if (layer.kind === "text" && !layer.curvedPath) {
        return `<g ${gAttrs.join(" ")}><svg x="${String(layer.x)}" y="${String(layer.y)}" width="${String(layer.width)}" height="${String(layer.height)}">${svgContent}</svg></g>`;
      }

      return gAttrs.length > 0
        ? `<g ${gAttrs.join(" ")}>${svgContent}</g>`
        : svgContent;
    }),
  );

  // Assemble final SVG
  const defs = filterDefs.length > 0 ? `<defs>${filterDefs.join("\n")}</defs>` : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">`,
    defs,
    `<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`,
    ...rendered,
    `</svg>`,
  ].join("\n");
}
