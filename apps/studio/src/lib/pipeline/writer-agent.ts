import { callGptSafe } from "@/lib/llm";
import type { PipelineOutline, PersonaContext, ContentType, ResearchPacket } from "./types";

/**
 * Persona Writer Agent — generates full draft content from outline.
 * Uses gpt-4o at higher temperature for creative writing.
 */
export async function generateDraft(
  outline: PipelineOutline,
  opts?: {
    persona?: PersonaContext | null;
    contentType?: ContentType;
    research?: ResearchPacket;
    editorFeedback?: string;
  },
): Promise<string> {
  const systemPrompt = buildSystemPrompt(opts?.persona ?? null, opts?.contentType ?? "blog");

  const feedbackSection = opts?.editorFeedback
    ? `\n\n--- EDITOR FEEDBACK (apply these corrections) ---\n${opts.editorFeedback}\n--- END FEEDBACK ---`
    : "";

  const researchSection = buildResearchContext(opts?.research);

  const userPrompt = `Write a complete blog article based on this outline.

TITLE: ${outline.title}
ANGLE: ${outline.angle}
TARGET WORD COUNT: ${outline.targetWordCount}+ words

OUTLINE:
${outline.sections
  .map(
    (s, i) =>
      `${i + 1}. ${s.heading}\n${s.keyPoints.map((p) => `   - ${p}`).join("\n")}`,
  )
  .join("\n\n")}

SEO KEYWORDS (weave naturally): ${outline.seoKeywords.join(", ")}
${researchSection}${feedbackSection}

Requirements:
- Write entirely in Korean (English terms for music/brand names are OK)
- Start with a compelling hook (not "오늘은 ~에 대해 알아보겠습니다" pattern)
- Use markdown formatting: # for title, ## for sections, ### for sub-sections
- Include specific examples, data, or references where relevant
- End with a thought-provoking conclusion, not a generic summary
- Maintain consistent voice throughout

Return ONLY the markdown content.`;

  return callGptSafe(userPrompt, {
    model: "gpt-4o",
    temperature: 0.8,
    maxTokens: 8000,
    timeoutMs: 120_000,
    systemPrompt,
  });
}

function buildSystemPrompt(persona: PersonaContext | null, contentType: ContentType): string {
  if (!persona) {
    return `You are a skilled Korean music/culture magazine writer.
Write with passion, specificity, and cultural insight.
Avoid generic filler phrases and clickbait.`;
  }

  const parts = [
    `You are "${persona.name}", a writer for a Korean music/culture magazine.`,
  ];

  // Identity
  if (persona.perspective) {
    parts.push(`Perspective: ${persona.perspective}`);
  }
  if (persona.expertiseAreas.length > 0) {
    parts.push(`Expertise: ${persona.expertiseAreas.join(", ")}`);
  }

  // Voice profile
  parts.push("", "=== VOICE PROFILE ===");

  if (persona.styleFingerprint) {
    parts.push(`Style: ${persona.styleFingerprint}`);
  }

  if (persona.tone) {
    const t = persona.tone as Record<string, number>;
    parts.push(
      `Tone: formality=${t.formality ?? 5}/10, humor=${t.humor ?? 3}/10, emotion=${t.emotion ?? 5}/10, energy=${t.energy ?? 5}/10`,
    );
  }

  if (persona.emotionalDrivers.length > 0) {
    parts.push(`Emotional drivers: ${persona.emotionalDrivers.join(", ")}`);
  }

  if (persona.vocabulary) {
    const v = persona.vocabulary as Record<string, unknown>;
    if (v.preferredWords)
      parts.push(`Preferred vocabulary: ${JSON.stringify(v.preferredWords)}`);
    if (v.avoidWords)
      parts.push(`Avoid: ${JSON.stringify(v.avoidWords)}`);
    if (v.level) parts.push(`Vocabulary level: ${v.level}`);
  }

  if (persona.structure) {
    const s = persona.structure as Record<string, unknown>;
    if (s.hookStyle) parts.push(`Hook style: ${s.hookStyle}`);
    if (s.paragraphPattern)
      parts.push(`Paragraph pattern: ${s.paragraphPattern}`);
  }

  // Channel-specific overrides
  if (persona.channelProfiles) {
    const profile = persona.channelProfiles[contentType] as Record<string, unknown> | undefined;
    if (profile) {
      parts.push("", `=== CHANNEL OVERRIDE (${contentType}) ===`);
      for (const [k, v] of Object.entries(profile)) {
        parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
      }
    }
  }

  // Content rules
  parts.push("", "=== RULES ===");

  if (persona.contentRules) {
    if (persona.contentRules.always.length > 0) {
      parts.push("ALWAYS:");
      for (const rule of persona.contentRules.always) {
        parts.push(`  - ${rule}`);
      }
    }
    if (persona.contentRules.never.length > 0) {
      parts.push("NEVER:");
      for (const rule of persona.contentRules.never) {
        parts.push(`  - ${rule}`);
      }
    }
  }

  parts.push(
    "- Maintain this voice consistently throughout the article",
    "- Avoid generic AI-sounding phrases",
    "- Be specific — reference actual songs, albums, artists, dates",
  );

  // Golden example (single best example to save tokens)
  const examples = persona.goldenExamples?.[contentType] ?? persona.goldenExamples?.["blog"] ?? [];
  if (examples.length > 0) {
    parts.push("", "=== REFERENCE EXAMPLE (match this style) ===");
    // Use only the first (best) example — saves ~300-500 tokens per call
    parts.push(`\n${examples[0]}`);
  }

  return parts.join("\n");
}

function buildResearchContext(research?: ResearchPacket): string {
  if (!research) return "";
  const parts: string[] = ["\n--- RESEARCH DATA (use these facts in your writing) ---"];

  if (research.artists.length > 0) {
    for (const a of research.artists) {
      parts.push(`\n[${a.name}${a.nameKo ? ` / ${a.nameKo}` : ""}]`);
      parts.push(`Genres: ${a.genres.join(", ")} | Popularity: ${a.popularity}/100`);
      if (a.bio) parts.push(`Bio: ${a.bio.slice(0, 300)}`);
      if (a.albums.length > 0) {
        parts.push(`Albums: ${a.albums.map((al) => `${al.title} (${al.releaseDate ?? "?"})`).join(", ")}`);
      }
      if (a.relatedArtists.length > 0) {
        parts.push(`Related: ${a.relatedArtists.map((r) => `${r.name} [${r.relationType}]`).join(", ")}`);
      }
    }
  }

  if (research.webSources.length > 0) {
    parts.push("\nWeb sources:");
    for (const s of research.webSources) {
      parts.push(`- ${s.title}: ${s.snippet}`);
    }
  }

  parts.push("--- END RESEARCH ---");
  return parts.join("\n");
}
