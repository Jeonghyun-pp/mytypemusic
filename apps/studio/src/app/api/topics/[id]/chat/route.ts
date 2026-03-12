import OpenAI from "openai";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

function sseEvent(data: string): string {
  return `data: ${data}\n\n`;
}

function buildSystemPrompt(draft: {
  topic: string;
  angle: string;
  reasoning: string;
  contentType: string;
  trendSources: string[];
  relatedEntities: string[];
  formats: unknown;
}): string {
  const formatsStr = draft.formats ? JSON.stringify(draft.formats) : "없음";
  const trendsStr = draft.trendSources.length > 0 ? draft.trendSources.join(", ") : "없음";
  const entitiesStr = draft.relatedEntities.length > 0 ? draft.relatedEntities.join(", ") : "없음";

  return `당신은 한국 인디/밴드 음악 웹매거진의 콘텐츠 전략가입니다.
사용자가 콘텐츠 주제를 다듬고 있습니다. 사용자의 요청에 따라 주제를 수정하거나 조언하세요.

## 현재 주제 상태
- 주제: ${draft.topic}
- 각도: ${draft.angle || "미설정"}
- 근거: ${draft.reasoning || "없음"}
- 콘텐츠 타입: ${draft.contentType}
- 트렌드 출처: ${trendsStr}
- 관련 엔티티: ${entitiesStr}
- 포맷 미리보기: ${formatsStr}

## 규칙
1. 항상 한국어로 응답
2. 사용자가 수정을 요청하면 topicUpdate에 변경된 필드를 포함
3. 사용자가 질문만 하면 topicUpdate는 null로
4. 주제는 항상 구체적이어야 함 (특정 아티스트, 곡, 앨범, 이벤트 포함)
5. formats는 변경 시 sns, blog, carousel 모두 포함

응답은 반드시 유효한 JSON:
{
  "message": "사용자에게 보여줄 설명 (Korean)",
  "topicUpdate": {
    "topic": "수정된 주제 (변경 시에만)",
    "angle": "수정된 각도 (변경 시에만)",
    "reasoning": "수정된 근거 (변경 시에만)",
    "formats": {
      "sns": "SNS 미리보기 (변경 시에만)",
      "blog": "블로그 미리보기 (변경 시에만)",
      "carousel": "카드뉴스 미리보기 (변경 시에만)"
    }
  }
}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  const { id } = await params;

  let body: { message: string };
  try {
    body = (await req.json()) as { message: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message?.trim()) {
    return new Response(JSON.stringify({ error: "message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load draft + recent messages
  const draft = await prisma.topicDraft.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
  });

  if (!draft) {
    return new Response(JSON.stringify({ error: "Draft not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build message history
  const history: Array<{ role: "user" | "assistant"; content: string }> =
    draft.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  history.push({ role: "user", content: body.message });

  const client = new OpenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(draft);

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
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

        // Parse result and persist
        let message = fullText;
        let topicUpdate: Record<string, unknown> | null = null;

        try {
          const parsed = JSON.parse(fullText) as Record<string, unknown>;
          message = (parsed.message as string) ?? fullText;
          topicUpdate = (parsed.topicUpdate as Record<string, unknown>) ?? null;
        } catch {
          // Not valid JSON — use raw text
        }

        // Save user message
        await prisma.topicMessage.create({
          data: {
            topicDraftId: id,
            role: "user",
            content: body.message,
          },
        });

        // Save assistant message
        await prisma.topicMessage.create({
          data: {
            topicDraftId: id,
            role: "assistant",
            content: message,
            topicUpdate: topicUpdate as JsonInput,
          },
        });

        // Apply topicUpdate to draft if present
        if (topicUpdate) {
          const updateData: Record<string, unknown> = { status: "refining" };

          if (topicUpdate.topic) updateData.topic = topicUpdate.topic;
          if (topicUpdate.angle) updateData.angle = topicUpdate.angle;
          if (topicUpdate.reasoning) updateData.reasoning = topicUpdate.reasoning;

          if (topicUpdate.formats) {
            // Merge with existing formats
            const existingFormats = (draft.formats as Record<string, unknown>) ?? {};
            const newFormats = topicUpdate.formats as Record<string, unknown>;
            updateData.formats = { ...existingFormats, ...newFormats };
          }

          await prisma.topicDraft.update({
            where: { id },
            data: updateData as JsonInput,
          });
        } else {
          // Mark as refining if first conversation
          if (draft.status === "saved") {
            await prisma.topicDraft.update({
              where: { id },
              data: { status: "refining" },
            });
          }
        }

        controller.enqueue(
          encoder.encode(
            sseEvent(JSON.stringify({ type: "result", message, topicUpdate })),
          ),
        );
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
