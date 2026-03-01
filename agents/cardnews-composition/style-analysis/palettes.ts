// ============================================================================
// Named Color Palettes — based on Instagram magazine style research
// ============================================================================

export interface ColorPalette {
  id: string;
  name: string;
  /** Main background color */
  background: string;
  /** Primary surface / section color */
  primary: string;
  /** Secondary accent surface */
  secondary: string;
  /** Accent color (dividers, highlights) */
  accent: string;
  /** Main text color */
  textColor: string;
  /** Footer / caption text color (with opacity) */
  footerColor: string;
}

/**
 * Research-based named palettes:
 *
 * - editorial:   디에디트 스타일 — 크림/오프화이트 배경, 따뜻한 톤
 * - monochrome:  데패뉴 스타일 — 흑백 하이콘트라스트
 * - warmVintage: 레트로/아날로그 감성 — 베이지/브라운 계열
 */
export const NAMED_PALETTES: Record<string, ColorPalette> = {
  editorial: {
    id: "editorial",
    name: "Editorial Warm",
    background: "#FAFAF8",
    primary: "#F5F0EB",
    secondary: "#E8E0D8",
    accent: "#1A1A1A",
    textColor: "#1A1A1A",
    footerColor: "rgba(26,26,26,0.5)",
  },

  monochrome: {
    id: "monochrome",
    name: "Monochrome",
    background: "#FFFFFF",
    primary: "#F5F5F5",
    secondary: "#333333",
    accent: "#000000",
    textColor: "#1A1A1A",
    footerColor: "rgba(26,26,26,0.5)",
  },

  warmVintage: {
    id: "warmVintage",
    name: "Warm Vintage",
    background: "#F5EDE3",
    primary: "#D4C5B2",
    secondary: "#8B7D6B",
    accent: "#8B7D6B",
    textColor: "#3D3529",
    footerColor: "rgba(61,53,41,0.5)",
  },

  // ── 추가 팔레트 (10종) ──────────────────────────────────

  neonDark: {
    id: "neonDark",
    name: "Neon Dark",
    background: "#0A0A0F",
    primary: "#1A1A2E",
    secondary: "#16213E",
    accent: "#E94560",
    textColor: "#EAEAEA",
    footerColor: "rgba(234,234,234,0.5)",
  },

  pastelSoft: {
    id: "pastelSoft",
    name: "Pastel Soft",
    background: "#FFF5F5",
    primary: "#FFE4E6",
    secondary: "#FECDD3",
    accent: "#F472B6",
    textColor: "#4A2532",
    footerColor: "rgba(74,37,50,0.5)",
  },

  deepForest: {
    id: "deepForest",
    name: "Deep Forest",
    background: "#1A2E1A",
    primary: "#2D4A2D",
    secondary: "#3D6B3D",
    accent: "#8FBC8F",
    textColor: "#E8F0E8",
    footerColor: "rgba(232,240,232,0.5)",
  },

  oceanBreeze: {
    id: "oceanBreeze",
    name: "Ocean Breeze",
    background: "#F0F7FA",
    primary: "#D6EAF2",
    secondary: "#A8D5E2",
    accent: "#1A6B8A",
    textColor: "#1A3A4A",
    footerColor: "rgba(26,58,74,0.5)",
  },

  sunsetWarm: {
    id: "sunsetWarm",
    name: "Sunset Warm",
    background: "#FFF3E6",
    primary: "#FFE0B2",
    secondary: "#FFB74D",
    accent: "#E65100",
    textColor: "#3E2723",
    footerColor: "rgba(62,39,35,0.5)",
  },

  urbanGrit: {
    id: "urbanGrit",
    name: "Urban Grit",
    background: "#2A2A2A",
    primary: "#3D3D3D",
    secondary: "#555555",
    accent: "#FF6B35",
    textColor: "#F0F0F0",
    footerColor: "rgba(240,240,240,0.5)",
  },

  luxuryGold: {
    id: "luxuryGold",
    name: "Luxury Gold",
    background: "#1A1A1A",
    primary: "#2D2D2D",
    secondary: "#3D3D3D",
    accent: "#C9A96E",
    textColor: "#F5F0E8",
    footerColor: "rgba(245,240,232,0.5)",
  },

  retroPop: {
    id: "retroPop",
    name: "Retro Pop",
    background: "#FFFDE7",
    primary: "#FFF9C4",
    secondary: "#FFEE58",
    accent: "#D84315",
    textColor: "#33261A",
    footerColor: "rgba(51,38,26,0.5)",
  },

  nightClub: {
    id: "nightClub",
    name: "Night Club",
    background: "#0D0015",
    primary: "#1A0033",
    secondary: "#2D004D",
    accent: "#BB86FC",
    textColor: "#E8DAEF",
    footerColor: "rgba(232,218,239,0.5)",
  },

  minimalMono: {
    id: "minimalMono",
    name: "Minimal Mono",
    background: "#F8F8F8",
    primary: "#EEEEEE",
    secondary: "#E0E0E0",
    accent: "#424242",
    textColor: "#212121",
    footerColor: "rgba(33,33,33,0.5)",
  },
};

/**
 * Get a named palette by ID. Returns undefined if not found.
 */
export function getPalette(paletteId: string): ColorPalette | undefined {
  return NAMED_PALETTES[paletteId];
}
