import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { json, badRequest, notFound, serverError } from "@/lib/studio";

const openai = new OpenAI();

/**
 * POST /api/persona/test — generate sample text with persona applied.
 * Body: { personaId: string, topic: string }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { personaId?: string; topic?: string };
    if (!body.personaId) return badRequest("personaId is required");
    if (!body.topic?.trim()) return badRequest("topic is required");

    const persona = await prisma.writingPersona.findUnique({
      where: { id: body.personaId },
    });
    if (!persona) return notFound("Persona not found");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a social media content writer.
${persona.styleFingerprint ? `Write in this style:\n${persona.styleFingerprint}` : ""}
${persona.tone ? `Tone: ${JSON.stringify(persona.tone)}` : ""}
${persona.vocabulary ? `Vocabulary: ${JSON.stringify(persona.vocabulary)}` : ""}
${persona.structure ? `Structure: ${JSON.stringify(persona.structure)}` : ""}

Write a Threads/SNS post about the given topic in Korean. Include 3-5 hashtags.`,
        },
        { role: "user", content: body.topic },
      ],
      max_tokens: 800,
    });

    return json({
      topic: body.topic,
      personaId: body.personaId,
      personaName: persona.name,
      generatedText: completion.choices[0]?.message?.content ?? "",
    });
  } catch (e) {
    return serverError(String(e));
  }
}
