import { prisma } from "@/lib/db";
import { json, badRequest, notFound, serverError } from "@/lib/studio";

/** POST /api/topics/[id]/launch — launch content pipeline from refined topic */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      target: string;
      personaId?: string;
    };

    const target = body.target;
    if (!target || !["blog", "sns", "design", "e2e"].includes(target)) {
      return badRequest("target must be one of: blog, sns, design, e2e");
    }

    const draft = await prisma.topicDraft.findUnique({ where: { id } });
    if (!draft) return notFound("Draft not found");

    const formats = draft.formats as Record<string, string> | null;
    const personaId = body.personaId ?? draft.personaId;

    // Mark draft as sent
    await prisma.topicDraft.update({
      where: { id },
      data: { status: "sent" },
    });

    switch (target) {
      case "blog": {
        // Create a PipelineRun and link to draft
        const run = await prisma.pipelineRun.create({
          data: {
            topic: draft.topic,
            angle: draft.angle,
            contentType: draft.contentType,
            personaId: personaId ?? null,
            status: "running",
          },
        });

        await prisma.topicDraft.update({
          where: { id },
          data: { pipelineRunId: run.id },
        });

        return json({
          pipelineRunId: run.id,
          redirectUrl: `/studio/blog?topic=${encodeURIComponent(draft.topic)}&outline=${encodeURIComponent(formats?.blog ?? "")}`,
        });
      }

      case "sns": {
        const text = formats?.sns ?? draft.topic;
        return json({
          redirectUrl: `/studio/publish?text=${encodeURIComponent(text)}`,
        });
      }

      case "design": {
        const carousel = formats?.carousel ?? "";
        return json({
          redirectUrl: `/studio/design?quick=1&topic=${encodeURIComponent(draft.topic)}&carousel=${encodeURIComponent(carousel)}`,
        });
      }

      case "e2e": {
        // Return the topic/persona info for the client to call /api/pipeline/e2e
        return json({
          topic: draft.topic,
          contentType: draft.contentType,
          personaId,
          redirectUrl: `/studio/blog?topic=${encodeURIComponent(draft.topic)}`,
        });
      }

      default:
        return badRequest("Invalid target");
    }
  } catch (e) {
    return serverError(String(e));
  }
}
