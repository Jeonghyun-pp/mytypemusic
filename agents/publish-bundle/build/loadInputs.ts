import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getTopicOutputsDir } from "../io/paths.js";

// ============================================================================
// Minimal Zod schemas for input validation (subset of Agent3/5 contracts)
// ============================================================================

const TopicIntelMinSchema = z.object({
  normalizedTopic: z.string().min(1),
  category: z.string().min(1),
  sources: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().min(1),
      publisher: z.string().optional(),
      publishedAt: z.string().optional(),
    }),
  ),
  riskNotes: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  region: z.enum(["KR", "GLOBAL"]).optional(),
});

const ContentPlanMinSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  category: z.enum(["music", "lifestyle"]),
  depth: z.enum(["news", "explainer", "analysis"]),
  slides: z.array(
    z.object({
      kind: z.enum(["cover", "fact", "summary", "cta", "credits"]),
      headline: z.string().min(1),
      bullets: z.array(z.string()).optional(),
      note: z.string().optional(),
    }),
  ),
  hashtags: z.array(z.string()),
  credits: z.object({
    sources: z.array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        publisher: z.string().optional(),
        publishedAt: z.string().optional(),
      }),
    ),
  }),
  createdAt: z.string().min(1),
});

const ValidatedPostMinSchema = z.object({
  attribution: z
    .object({
      captionAppendix: z.string().optional(),
      footerCredits: z.union([z.string(), z.array(z.unknown())]).optional(),
      perImageCredits: z
        .array(
          z.object({
            localPath: z.string().optional(),
            creditLine: z.string().optional(),
            assetId: z.string().optional(),
            text: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  notes: z.array(z.string()).optional(),
  riskNotes: z.array(z.string()).optional(),
});

// ============================================================================
// BuildInputs type
// ============================================================================

export type BuildInputs = {
  topicId: string;
  topicIntelPath: string;
  contentPlanPath: string;
  captionDraftPath?: string;
  agent2TopicPath?: string;
  validatedPostPath?: string;
  deckManifestPath?: string;

  topicIntel: z.infer<typeof TopicIntelMinSchema>;

  contentPlan: z.infer<typeof ContentPlanMinSchema>;

  captionDraft?: string;

  validatedPost?: {
    attribution?: {
      captionAppendix?: string;
      footerCredits?: string;
      perImageCredits?: Array<{ localPath: string; creditLine: string }>;
    };
    riskNotes?: string[];
  };
};

// ============================================================================
// Helpers
// ============================================================================

async function tryReadJson(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function tryReadText(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function fileExists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Normalize Agent1 validated-post into the subset we need.
 */
function normalizeValidatedPost(
  raw: z.infer<typeof ValidatedPostMinSchema>,
): BuildInputs["validatedPost"] {
  const result: NonNullable<BuildInputs["validatedPost"]> = {};

  // riskNotes: merge "notes" and "riskNotes" fields
  const allNotes: string[] = [];
  if (raw.notes) allNotes.push(...raw.notes);
  if (raw.riskNotes) allNotes.push(...raw.riskNotes);
  if (allNotes.length > 0) result.riskNotes = allNotes;

  if (raw.attribution) {
    const attr: NonNullable<typeof result.attribution> = {};

    if (raw.attribution.captionAppendix) {
      attr.captionAppendix = raw.attribution.captionAppendix;
    }

    // footerCredits might be string or array
    if (typeof raw.attribution.footerCredits === "string") {
      attr.footerCredits = raw.attribution.footerCredits;
    }

    // perImageCredits: normalize from Agent1's AttributionLine format
    if (raw.attribution.perImageCredits) {
      attr.perImageCredits = raw.attribution.perImageCredits
        .map((c) => ({
          localPath: c.localPath ?? c.assetId ?? "",
          creditLine: c.creditLine ?? c.text ?? "",
        }))
        .filter((c) => c.localPath.length > 0 && c.creditLine.length > 0);
    }

    if (Object.keys(attr).length > 0) result.attribution = attr;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ============================================================================
// Main loader
// ============================================================================

export async function loadBuildInputs(
  topicId: string,
): Promise<{ inputs: BuildInputs; warnings: string[] }> {
  const warnings: string[] = [];
  const dir = getTopicOutputsDir(topicId);

  // ---- topic-intel.json (fallback to topic-request.json) ----
  const topicIntelPath = path.join(dir, "topic-intel.json");
  const rawIntel = await tryReadJson(topicIntelPath);
  let topicIntel: z.infer<typeof TopicIntelMinSchema>;
  if (rawIntel !== undefined) {
    topicIntel = TopicIntelMinSchema.parse(rawIntel);
  } else {
    // Non-intel PostTypes (album_recommendation, meme, etc.) skip topic_intel
    // steps entirely. Build a minimal stub from topic-request.json.
    const reqPath = path.join(dir, "topic-request.json");
    const rawReq = await tryReadJson(reqPath) as Record<string, unknown> | undefined;
    if (rawReq === undefined) {
      throw new Error(
        `Neither topic-intel.json nor topic-request.json found in ${dir}`,
      );
    }
    topicIntel = TopicIntelMinSchema.parse({
      normalizedTopic: rawReq.seedKeyword ?? topicId,
      category: rawReq.category ?? "music",
      sources: [],
      riskNotes: [],
      region: rawReq.region ?? "KR",
    });
    warnings.push("topic-intel.json not found — using stub from topic-request.json");
  }

  // ---- content-plan.json (fallback to topic-request.json + topic.agent2.json) ----
  const contentPlanPath = path.join(dir, "content-plan.json");
  const rawPlan = await tryReadJson(contentPlanPath);
  let contentPlan: z.infer<typeof ContentPlanMinSchema>;
  if (rawPlan !== undefined) {
    contentPlan = ContentPlanMinSchema.parse(rawPlan);
  } else {
    // For non-intel PostTypes, generate a minimal content plan from available data.
    const reqPath = path.join(dir, "topic-request.json");
    const rawReq = await tryReadJson(reqPath) as Record<string, unknown> | undefined;
    const a2Path = path.join(dir, "topic.agent2.json");
    const rawA2 = await tryReadJson(a2Path) as Record<string, unknown> | undefined;

    const title = (rawA2?.title ?? rawReq?.seedKeyword ?? topicId) as string;
    const cat = (rawReq?.category ?? "music") as string;

    contentPlan = ContentPlanMinSchema.parse({
      title,
      category: cat === "music" ? "music" : "lifestyle",
      depth: rawReq?.depth ?? "explainer",
      slides: [],
      hashtags: [],
      credits: { sources: [] },
      createdAt: new Date().toISOString(),
    });
    warnings.push("content-plan.json not found — using stub from topic-request.json");
  }

  // ---- Optional: caption.draft.txt ----
  const captionDraftPath = path.join(dir, "caption.draft.txt");
  const captionDraft = await tryReadText(captionDraftPath);
  if (captionDraft === undefined) {
    warnings.push("caption.draft.txt not found — caption.text will be empty");
  }

  // ---- Optional: topic.agent2.json (provenance only) ----
  const agent2TopicPath = path.join(dir, "topic.agent2.json");
  const agent2TopicExists = await fileExists(agent2TopicPath);
  if (!agent2TopicExists) {
    warnings.push("topic.agent2.json not found — provenance will omit it");
  }

  // ---- Optional: validated-post.json ----
  const validatedPostPath = path.join(dir, "validated-post.json");
  const rawPost = await tryReadJson(validatedPostPath);
  let validatedPost: BuildInputs["validatedPost"];
  if (rawPost === undefined) {
    warnings.push(
      "validated-post.json not found — compliance.attribution will be empty",
    );
  } else {
    try {
      const parsed = ValidatedPostMinSchema.parse(rawPost);
      validatedPost = normalizeValidatedPost(parsed);
    } catch {
      warnings.push(
        "validated-post.json failed validation — skipping attribution",
      );
    }
  }

  // ---- Optional: layout_manifest.json ----
  const deckManifestPath = path.join(dir, "layout_manifest.json");
  const manifestExists = await fileExists(deckManifestPath);
  if (!manifestExists) {
    warnings.push("layout_manifest.json not found — deck will use PNG scan");
  }

  return {
    inputs: {
      topicId,
      topicIntelPath,
      contentPlanPath,
      captionDraftPath: captionDraft !== undefined ? captionDraftPath : undefined,
      agent2TopicPath: agent2TopicExists ? agent2TopicPath : undefined,
      validatedPostPath: rawPost !== undefined ? validatedPostPath : undefined,
      deckManifestPath: manifestExists ? deckManifestPath : undefined,

      topicIntel,
      contentPlan,
      captionDraft,
      validatedPost,
    },
    warnings,
  };
}
