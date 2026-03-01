// ============================================================================
// Guardrail violation & report types
// ============================================================================

export type GuardrailViolation = {
  slideIndex?: number;
  kind?: "cover" | "fact" | "summary" | "cta" | "credits" | "album_cover" | "tracklist" | "meme" | "album_grid" | "concert_info";
  field?: "headline" | "bullet" | "note" | "caption";
  type: "number_changed" | "date_changed" | "entity_changed";
  detail: string;
};

export type GuardrailReport = {
  topicId: string;
  violations: GuardrailViolation[];
  slidesRolledBack: number;
  captionRolledBack: boolean;
};
