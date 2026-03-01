import fs from "node:fs/promises";
import path from "node:path";

const OUTPUTS_DIR = path.join(process.cwd(), "agents", "trend-signals", "outputs");

/**
 * Build output file path: outputs/signal-{seed}-{timestamp}.json
 */
export function getSignalResultPath(seedKeyword: string): string {
  const safe = seedKeyword.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 30);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return path.join(OUTPUTS_DIR, `signal-${safe}-${ts}.json`);
}

/**
 * Save an object as pretty-printed JSON.
 */
export async function saveJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
