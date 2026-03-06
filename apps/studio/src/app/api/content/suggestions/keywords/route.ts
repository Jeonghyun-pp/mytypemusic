import { json, serverError } from "@/lib/studio";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const KEYWORDS_FILE = path.join(DATA_DIR, "niche-keywords.json");

interface KeywordsData {
  keywords: string[];
  updatedAt: string;
}

async function loadKeywords(): Promise<string[]> {
  try {
    const raw = await readFile(KEYWORDS_FILE, "utf-8");
    const data = JSON.parse(raw) as KeywordsData;
    return data.keywords;
  } catch {
    return [];
  }
}

async function saveKeywords(keywords: string[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const data: KeywordsData = {
    keywords,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(KEYWORDS_FILE, JSON.stringify(data, null, 2), "utf-8");
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
