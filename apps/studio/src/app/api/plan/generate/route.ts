import OpenAI from "openai";
import { PlanGenerateRequestSchema, PlanGenerateResponseSchema } from "@/lib/studio/plan/types";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";

interface FrequencyInput {
  weeklyTotal: number;
  maxPerDay: number;
  heavyDays?: number[];
}

const DAY_NAMES_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;

function buildSystemPrompt(
  startDate: string,
  endDate: string,
  frequency: FrequencyInput,
  existingEvents: Array<{ date: string; title: string; category: string }>,
  preferences?: {
    focusCategories?: string[];
    avoidCategories?: string[];
    typeRatio?: { post: number; reels: number; promotion: number };
    notes?: string;
  },
): string {
  const categories = CONTENT_CATEGORIES.map(
    (c) => `  - ${c.id}: ${c.label} — ${c.description}`,
  ).join("\n");

  const existingJson =
    existingEvents.length > 0
      ? JSON.stringify(existingEvents, null, 2)
      : "(없음)";

  const prefSection: string[] = [];
  if (preferences?.focusCategories?.length) {
    prefSection.push(
      `선호 카테고리 (비중 높게): ${preferences.focusCategories.join(", ")}`,
    );
  }
  if (preferences?.avoidCategories?.length) {
    prefSection.push(
      `제외 카테고리 (사용하지 않기): ${preferences.avoidCategories.join(", ")}`,
    );
  }
  if (preferences?.typeRatio) {
    const r = preferences.typeRatio;
    const allowed = Object.entries(r)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ");
    const forbidden = Object.entries(r)
      .filter(([, v]) => v === 0)
      .map(([k]) => k);
    prefSection.push(`타입 비율: ${allowed}`);
    if (forbidden.length > 0) {
      prefSection.push(
        `STRICTLY FORBIDDEN types (0% — NEVER use these): ${forbidden.join(", ")}. Do NOT generate any item with these types.`,
      );
    }
  }
  if (preferences?.notes) {
    prefSection.push(`추가 요청: ${preferences.notes}`);
  }

  const heavyDaysText =
    frequency.heavyDays && frequency.heavyDays.length > 0
      ? `집중 요일: ${frequency.heavyDays.map((d) => DAY_NAMES_KR[d]).join(", ")} — 이 요일에 더 많은 게시물을 배치할 것`
      : "";

  return `You are an Instagram content planning assistant for a Korean music magazine.
Given a date range and posting frequency, generate a content schedule.

## Content Categories (MUST use these exact IDs):
${categories}

## Rules:
1. 날짜 범위: ${startDate} ~ ${endDate}, 주 ${frequency.weeklyTotal}개 게시, 하루 최대 ${frequency.maxPerDay}개
${heavyDaysText ? `   ${heavyDaysText}` : ""}
2. 카테고리 분산 — 같은 카테고리 주 3회 이상 금지
3. 요일 최적화 — 집중 요일이 지정되지 않은 경우 화/목/토는 post 선호, 월/수는 reels 선호 (단, User Preferences에서 특정 타입이 0%이면 해당 타입은 절대 사용하지 말 것)
4. promotion은 주 1회 이하
5. 제목은 한국어로, 구체적이고 클릭을 유도하는 형태
6. 현재 계절과 한국 문화 이벤트/트렌드 반영
7. 기존 캘린더 이벤트와 주제 중복 금지
8. tags는 한국어 인스타그램 해시태그 (# 포함, 5개 이내)
9. reasoning은 왜 이 날짜에 이 카테고리/주제를 선택했는지 1문장 설명

${prefSection.length > 0 ? "## User Preferences:\n" + prefSection.join("\n") : ""}

## Existing calendar events (avoid duplication):
${existingJson}

## Output Format:
Respond with a JSON object containing:
- "items": array of objects, each with: date, title, description, type, category, tags, reasoning
- "summary": 전체 플랜 전략을 1-2문장으로 요약 (한국어)

IMPORTANT: Output MUST be valid JSON. category values must be one of the exact IDs listed above. type must be "post", "reels", or "promotion".`;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PlanGenerateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { startDate, endDate, frequency, existingEvents, preferences } = parsed.data;

  const client = new OpenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(
    startDate,
    endDate,
    frequency,
    existingEvents ?? [],
    preferences,
  );

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${startDate}부터 ${endDate}까지 주 ${frequency.weeklyTotal}개, 하루 최대 ${frequency.maxPerDay}개 콘텐츠 플랜을 생성해줘.${
            frequency.heavyDays?.length
              ? ` ${frequency.heavyDays.map((d) => DAY_NAMES_KR[d]).join("/")}요일에 더 많이 배치해줘.`
              : ""
          }`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const json = JSON.parse(text) as unknown;
    const validated = PlanGenerateResponseSchema.safeParse(json);

    if (validated.success) {
      const result = validated.data;

      // Enforce type ratio: reassign forbidden types (0%) to allowed types
      if (preferences?.typeRatio) {
        const ratio = preferences.typeRatio;
        const forbidden = new Set(
          (Object.entries(ratio) as [string, number][])
            .filter(([, v]) => v === 0)
            .map(([k]) => k),
        );

        if (forbidden.size > 0) {
          const allowed = (["post", "reels", "promotion"] as const).filter(
            (t) => !forbidden.has(t),
          );
          if (allowed.length > 0) {
            // Weighted pick based on ratio
            const totalWeight = allowed.reduce((s, t) => s + ratio[t], 0);

            for (const item of result.items) {
              if (forbidden.has(item.type)) {
                // Pick replacement weighted by ratio
                let r = Math.random() * totalWeight;
                let picked = allowed[0]!;
                for (const t of allowed) {
                  r -= ratio[t];
                  if (r <= 0) {
                    picked = t;
                    break;
                  }
                }
                item.type = picked;
              }
            }
          }
        }
      }

      return Response.json(result);
    }

    // Fallback: return raw if items exist but validation failed on some fields
    return Response.json(
      { error: "AI response validation failed", raw: json },
      { status: 502 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
