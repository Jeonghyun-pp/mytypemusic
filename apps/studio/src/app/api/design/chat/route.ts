import OpenAI from "openai";
import { DesignSpecSchema, AiDesignResponseSchema } from "@/lib/studio/designEditor/types";
import type { DesignSpec, TemplateId } from "@/lib/studio/designEditor/types";
import { TEMPLATES } from "@/lib/studio/designEditor/templates";

// ── Request / Response types ─────────────────────────────

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  designSpec: DesignSpec;
}

// ── System prompt builder ────────────────────────────────

function buildSystemPrompt(spec: DesignSpec): string {
  const slide = spec.slides[spec.currentSlideIndex];
  if (!slide) return "";

  const slideLabel =
    slide.kind === "cover"
      ? "커버"
      : slide.kind === "cta"
        ? "아웃트로"
        : slide.kind === "infographic"
          ? "인포그래픽"
          : `팩트 ${String(spec.currentSlideIndex)}`;

  const tmpl = TEMPLATES[slide.templateId as TemplateId] ?? { label: slide.templateId };
  const isCodeMode = Boolean(slide.customHtml);

  const allTemplates = (Object.keys(TEMPLATES) as TemplateId[])
    .map((id) => `  - ${id}: ${TEMPLATES[id].label}`)
    .join("\n");

  // ── Code mode: AI directly modifies the HTML ──────────
  if (isCodeMode) {
    return `You are a Korean Instagram card-news design assistant.
The user is editing a ${String(spec.slides.length)}-slide deck.
Currently editing: Slide ${String(spec.currentSlideIndex + 1)} (${slideLabel})

**CODE MODE ACTIVE**: This slide uses custom HTML code. You must modify the HTML directly.

Current HTML code:
\`\`\`html
${slide.customHtml}
\`\`\`

Canvas size: 1080 × 1350px
Renderer: Satori (supports inline styles only, no external CSS)

Satori constraints:
- Every <div> MUST have display:flex (or display:contents / display:none)
- No support: text-shadow, box-shadow, filter:brightness(), object-fit
- Image % dimensions don't work → use absolute px
- Both HTML inline styles (style="...") and JSX styles (style={{ }}) are accepted

Available actions in code mode:
- update_html: Provide the COMPLETE modified HTML in the "html" field. Do NOT use other actions.

IMPORTANT RULES:
1. Always respond in Korean
2. Your response MUST be valid JSON matching this schema:
{
  "message": "사용자에게 보여줄 자연어 설명",
  "actions": [
    {
      "action": "update_html",
      "html": "<div style=\\"...\\">...전체 수정된 HTML...</div>",
      "explanation": "변경 설명"
    }
  ]
}
3. The "html" field must contain the COMPLETE HTML (not a diff or partial)
4. Preserve the overall structure of the user's code — only change what was requested
5. If the user just asks a question without requesting changes, return empty actions array
6. For colors use hex (#ffffff) or rgba()`;
  }

  // ── Template mode: existing logic ─────────────────────
  return `You are a Korean Instagram card-news design assistant.
The user is editing a ${String(spec.slides.length)}-slide deck.

Currently editing: Slide ${String(spec.currentSlideIndex + 1)} (${slideLabel})
Template: ${slide.templateId} (${tmpl.label})
Title: "${slide.title}"
Body: "${slide.bodyText}"
Footer: "${slide.footerText}"
Style overrides: ${JSON.stringify(slide.styleOverrides ?? {})}
Global style: ${JSON.stringify(spec.globalStyle ?? {})}

Available templates:
${allTemplates}

Available actions:
- update_text: Change title/bodyText/footerText
- update_style: Change style overrides (bgGradient, textColor, accentColor, footerColor, titleSizePx, bodySizePx, headlineSizePx, titleWeight, bodyWeight, letterSpacing, scrimOpacity, imageBrightness, cardRadius)
- change_template: Switch template (provide templateId)
- change_kind: Change slide kind (cover/fact/cta/quote/stat/list/ranking/sns/infographic)
- add_slide: Add new slide after current
- remove_slide: Remove current slide
- apply_global_style: Set global style for all slides

Infographic data format (bodyText):
- infographic.bar.v1: "Label | Value" per line (e.g. "BTS | 1200")
- infographic.donut.v1: "Label | Value" per line (e.g. "K-Pop | 45")
- infographic.comparison.v1: First line "LeftName | RightName", then "Metric | LeftVal | RightVal" per line (e.g. "BTS | NewJeans\n스트리밍 | 500만 | 320만")
- infographic.timeline.v1: "Label | Date | Description" per line (e.g. "데뷔 | 2020.03 | 첫 미니앨범 발매")

IMPORTANT RULES:
1. Always respond in Korean
2. Your response MUST be valid JSON matching this schema:
{
  "message": "사용자에게 보여줄 자연어 설명",
  "actions": [
    {
      "action": "update_text|update_style|change_template|...",
      "slideIndex": 0,
      "textChanges": { "title": "...", "bodyText": "...", "footerText": "..." },
      "styleChanges": { "bgGradient": "...", "textColor": "...", ... },
      "templateId": "cover.hero.v1",
      "kind": "cover|fact|cta",
      "explanation": "이 변경의 이유"
    }
  ]
}
3. If the user just asks a question without requesting changes, return empty actions array
4. slideIndex defaults to current slide (${String(spec.currentSlideIndex)}) if omitted
5. For gradients use CSS linear-gradient syntax
6. For colors use hex (#ffffff) or rgba()`;
}

// ── SSE helpers ──────────────────────────────────────────

function sseEvent(data: string): string {
  return `data: ${data}\n\n`;
}

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const specParsed = DesignSpecSchema.safeParse(body.designSpec);
  if (!specParsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid designSpec", details: specParsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = new OpenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(specParsed.data);

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 4000,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(sseEvent(JSON.stringify({ type: "delta", text }))),
            );
          }
        }

        // Parse the accumulated JSON and validate actions
        try {
          const parsed = JSON.parse(fullText) as Record<string, unknown>;
          const validated = AiDesignResponseSchema.safeParse(parsed);

          if (validated.success) {
            controller.enqueue(
              encoder.encode(
                sseEvent(JSON.stringify({
                  type: "actions",
                  message: validated.data.message,
                  actions: validated.data.actions,
                })),
              ),
            );
          } else {
            // JSON was valid but didn't match schema — send message only
            controller.enqueue(
              encoder.encode(
                sseEvent(JSON.stringify({
                  type: "actions",
                  message: (parsed.message as string) ?? fullText,
                  actions: [],
                })),
              ),
            );
          }
        } catch {
          // Not valid JSON — send raw text as message
          controller.enqueue(
            encoder.encode(
              sseEvent(JSON.stringify({
                type: "actions",
                message: fullText,
                actions: [],
              })),
            ),
          );
        }

        controller.enqueue(encoder.encode(sseEvent("[DONE]")));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
