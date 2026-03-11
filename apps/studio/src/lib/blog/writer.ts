import { callGptJson, callGptSafe } from "@/lib/llm";

interface BlogOutline {
  title: string;
  sections: Array<{ heading: string; keyPoints: string[] }>;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
}

/**
 * Generate a blog post outline from a topic.
 */
export async function generateOutline(
  topic: string,
  opts?: { personaContext?: string; targetWordCount?: number },
): Promise<BlogOutline> {
  const prompt = `You are a professional Korean blog writer and SEO specialist.

Generate a detailed blog post outline for the topic: "${topic}"

Target word count: ${opts?.targetWordCount ?? 2000}+ words
${opts?.personaContext ?? ""}

Return a JSON object with:
- title: compelling blog title (Korean)
- sections: array of { heading: string, keyPoints: string[] } (at least 5 sections)
- seoTitle: SEO-optimized title (Korean, under 60 chars)
- seoDescription: meta description (Korean, under 160 chars)
- seoKeywords: array of 5-10 SEO keywords (Korean)

Respond ONLY with the JSON object.`;

  return callGptJson<BlogOutline>(prompt, { caller: "blog", model: "gpt-4o-mini", temperature: 0.7 });
}

/**
 * Generate full blog content from an outline, section by section.
 */
export async function generateContent(
  outline: BlogOutline,
  opts?: { personaContext?: string },
): Promise<string> {
  const sections: string[] = [];

  // Introduction
  const introPrompt = `Write an engaging introduction (200-300 words) for a Korean blog post titled "${outline.title}".

Sections covered in the post:
${outline.sections.map((s) => `- ${s.heading}`).join("\n")}

${opts?.personaContext ?? ""}

Write in Korean. Be engaging and hook the reader. Return ONLY the markdown content.`;

  const intro = await callGptSafe(introPrompt, { caller: "blog", maxTokens: 1000 });
  sections.push(`# ${outline.title}\n\n${intro}`);

  // Body sections
  for (const section of outline.sections) {
    const sectionPrompt = `Write a detailed section (300-500 words) for a Korean blog post.

Blog title: "${outline.title}"
Section heading: "${section.heading}"
Key points to cover:
${section.keyPoints.map((p) => `- ${p}`).join("\n")}

${opts?.personaContext ?? ""}

Write in Korean. Include examples, data, or practical tips where relevant.
Use markdown formatting (## for heading, ### for sub-sections, lists, bold).
Return ONLY the markdown content starting with ## heading.`;

    const sectionContent = await callGptSafe(sectionPrompt, { caller: "blog", maxTokens: 1500 });
    sections.push(sectionContent);
  }

  // Conclusion
  const conclusionPrompt = `Write a compelling conclusion (150-200 words) for a Korean blog post titled "${outline.title}".

${opts?.personaContext ?? ""}

Summarize key takeaways and include a call-to-action. Write in Korean.
Return ONLY the markdown content starting with ## heading.`;

  const conclusion = await callGptSafe(conclusionPrompt, { caller: "blog", maxTokens: 500 });
  sections.push(conclusion);

  return sections.join("\n\n---\n\n");
}

/**
 * Generate a URL-friendly slug from a title.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) + "-" + Date.now().toString(36);
}
