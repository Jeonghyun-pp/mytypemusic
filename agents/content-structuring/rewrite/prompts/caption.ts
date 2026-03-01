// ============================================================================
// Caption rewrite prompt
// ============================================================================

export function buildCaptionUserPrompt(params: {
  captionDraft: string;
  angleCandidate?: string;
  category: "music" | "lifestyle";
  depth: "news" | "explainer" | "analysis";
  hashtags: string[];
}): string {
  const { captionDraft, angleCandidate, category, depth, hashtags } = params;

  const sections: string[] = [
    `TASK: Edit the following Instagram caption for a ${category}/${depth} magazine post.`,
    "",
    "GOAL:",
    "- First 1-2 sentences: a hook that draws attention (but NOT sensational or clickbait).",
    "- 2-3 bullet-style summary sentences within the text body.",
    "- Last line: hashtags — keep all existing hashtags (do not add or remove, only reorder if needed, maintain 10-15 total).",
    "- Do NOT include any URLs.",
    "- Write in natural, fluent Korean.",
  ];

  if (angleCandidate) {
    sections.push("", `ANGLE HINT: ${angleCandidate}`);
  }

  sections.push(
    "",
    "=== CAPTION_DRAFT ===",
    captionDraft,
    "",
    "=== HASHTAGS (must all appear in output) ===",
    hashtags.join(" "),
    "",
    "=== OUTPUT FORMAT ===",
    '{ "captionText": "..." }',
  );

  return sections.join("\n");
}
