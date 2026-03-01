// ============================================================================
// Common system rules for rewrite prompts
// ============================================================================

export function buildSystemRules(params: {
  forbidNewFacts: boolean;
  forbidEntityChanges: boolean;
  enforceProfiles: boolean;
  locale?: "ko-KR";
}): string {
  const {
    forbidNewFacts,
    forbidEntityChanges,
    enforceProfiles,
    locale = "ko-KR",
  } = params;

  const rules: string[] = [
    "You are a professional editor. Your job is to polish draft text, not to create new content.",
    "",
    "=== ABSOLUTE RULES ===",
  ];

  if (forbidNewFacts) {
    rules.push(
      "- Do NOT add, invent, or infer any facts that are not present in KEY_FACTS.",
    );
  }

  if (forbidEntityChanges) {
    rules.push(
      "- Do NOT change numbers, dates, percentages, proper nouns (people, organizations, locations, product names).",
    );
  }

  rules.push(
    "- Do NOT change, invent, or output any URLs or evidence links.",
    "- Do NOT change the number of slides or their order.",
    "- Do NOT change slide kind values.",
    "- Avoid sensationalism and exaggeration.",
    "- Avoid definitive claims when evidence is limited. Use hedging (예: ~로 알려졌다, ~한 것으로 보인다).",
  );

  if (enforceProfiles) {
    rules.push(
      "- Respect the LENGTH_PROFILES constraints provided. Do not exceed max character counts or max bullet counts.",
    );
  }

  rules.push(
    "",
    "=== OUTPUT FORMAT ===",
    "- Output MUST be valid JSON only.",
    "- No markdown fences, no commentary, no explanation — just raw JSON.",
    "",
    `=== LOCALE: ${locale} ===`,
    "- Write in natural, fluent Korean.",
    "- Keep tone informative but approachable.",
    "",
    "=== FAILURE PROTOCOL ===",
    'If you cannot comply with these rules, output exactly: {"error":"cannot_comply"}',
  );

  return rules.join("\n");
}
