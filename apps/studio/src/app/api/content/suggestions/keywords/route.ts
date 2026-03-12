import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

const SETTING_KEY = "niche-keywords";

async function loadKeywords(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return [];
  const data = row.value as { keywords?: string[] };
  return data.keywords ?? [];
}

async function saveKeywords(keywords: string[]): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: { keywords } },
    create: { key: SETTING_KEY, value: { keywords } },
  });
}

/** GET /api/content/suggestions/keywords */
export async function GET() {
  try {
    const keywords = await loadKeywords();
    return json({ keywords });
  } catch (e) {
    return serverError(String(e));
  }
}

/** PUT /api/content/suggestions/keywords */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { keywords?: string[] };
    const keywords = (body.keywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean);
    await saveKeywords(keywords);
    return json({ keywords });
  } catch (e) {
    return serverError(String(e));
  }
}
