// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;
import { prisma } from "@/lib/db";
import { callGptJson } from "@/lib/llm";
import { z } from "zod";
import type { JobHandler } from "../types";

const learningSchema = z.object({
  addPreferred: z.array(z.string()).default([]),
  addAvoid: z.array(z.string()).default([]),
  structureNotes: z.string().default(""),
  updatedFingerprint: z.string().default(""),
});

/**
 * Persona learning job: analyzes post performance by persona,
 * compares top vs bottom performers, and updates persona parameters.
 *
 * Triggered daily after analytics collection.
 */
export const personaLearnHandler: JobHandler = {
  type: "persona_learn",
  async handle() {
    const personas = await prisma.writingPersona.findMany({
      where: { isActive: true },
    });

    let updated = 0;

    for (const persona of personas) {
      // Get publications made with this persona
      const publications = await prisma.publication.findMany({
        where: { personaId: persona.id, status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 50,
      });

      if (publications.length < 5) continue;

      const pubIds = publications.map((p) => p.id);
      const performances = await prisma.postPerformance.findMany({
        where: { publicationId: { in: pubIds } },
      });

      if (performances.length < 5) continue;

      // Sort by engagement rate, split top/bottom third
      const sorted = [...performances].sort(
        (a, b) => b.engagementRate - a.engagementRate,
      );
      const third = Math.ceil(sorted.length / 3);
      const topPerf = sorted.slice(0, third);
      const bottomPerf = sorted.slice(-third);

      const topPubIds = new Set(topPerf.map((p) => p.publicationId));
      const bottomPubIds = new Set(bottomPerf.map((p) => p.publicationId));

      const topContent = publications
        .filter((p) => topPubIds.has(p.id))
        .map((p) => ((p.content as Record<string, unknown>)?.text as string) ?? "")
        .filter(Boolean)
        .slice(0, 10);

      const bottomContent = publications
        .filter((p) => bottomPubIds.has(p.id))
        .map((p) => ((p.content as Record<string, unknown>)?.text as string) ?? "")
        .filter(Boolean)
        .slice(0, 10);

      if (topContent.length < 2) continue;

      const prompt = `같은 저자의 SNS 게시물 중 성과가 좋은 것과 나쁜 것을 비교 분석해주세요.

현재 페르소나 스타일: ${persona.styleFingerprint || "미정의"}
현재 톤: ${JSON.stringify(persona.tone)}

## 성과 좋은 게시물 (높은 참여율):
${topContent.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join("\n")}

## 성과 낮은 게시물 (낮은 참여율):
${bottomContent.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join("\n")}

JSON으로 반환:
- addPreferred: 효과적인 단어/표현 배열
- addAvoid: 피해야 할 단어/표현 배열
- structureNotes: 잘 되는 구조적 패턴 (1-2문장)
- updatedFingerprint: 학습 내용을 반영한 업데이트된 스타일 설명 (한국어, 2-3문단)

JSON만 반환하세요.`;

      try {
        const result = await callGptJson(prompt, {
          caller: "persona-learn",
          schema: learningSchema,
          temperature: 0.4,
        });

        // Merge vocabulary learnings
        const currentVocab = (persona.vocabulary as Record<string, unknown>) ?? {};
        const preferred = currentVocab.preferredWords as string[] ?? [];
        const avoid = currentVocab.avoidWords as string[] ?? [];

        const mergedVocab = {
          ...currentVocab,
          preferredWords: [...new Set([...preferred, ...(result.addPreferred ?? [])])].slice(-30),
          avoidWords: [...new Set([...avoid, ...(result.addAvoid ?? [])])].slice(-20),
        };

        await prisma.writingPersona.update({
          where: { id: persona.id },
          data: {
            vocabulary: mergedVocab as JsonInput,
            styleFingerprint: result.updatedFingerprint || persona.styleFingerprint,
          },
        });
        updated++;
      } catch {
        /* skip on failure */
      }
    }

    return { personasAnalyzed: personas.length, personasUpdated: updated };
  },
};
