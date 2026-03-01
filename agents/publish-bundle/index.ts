import type { PublishBundle } from "./contracts.js";
import { savePublishBundle } from "./io/save.js";
import { loadBuildInputs } from "./build/loadInputs.js";
import { collectDeckAssets } from "./build/collectDeckAssets.js";
import { buildPublishBundle } from "./build/buildBundle.js";
import { parsePublishBundle } from "./schema.js";
import { getTopicOutputsDir } from "./io/paths.js";

// ============================================================================
// scaffold (14-A)
// ============================================================================

/**
 * Create a scaffold (empty template) PublishBundle for a given topicId.
 * All fields are set to valid minimums so the schema passes.
 */
export async function scaffoldBundle(topicId: string): Promise<{
  bundle: PublishBundle;
  savedPath: string;
}> {
  const bundle: PublishBundle = {
    topicId,
    category: "lifestyle",
    region: "KR",
    title: "TEMP",

    deck: {
      size: { width: 1080, height: 1350 },
      format: "png",
      slides: [],
    },

    caption: {
      text: "",
      hashtags: [],
    },

    compliance: {
      riskNotes: [],
      attribution: {},
      sources: [],
    },

    provenance: {},

    createdAt: new Date().toISOString(),
    version: "1.0",
  };

  const savedPath = await savePublishBundle(topicId, bundle);
  return { bundle, savedPath };
}

// ============================================================================
// build (14-B)
// ============================================================================

export type BuildResult = {
  bundle: PublishBundle;
  savedPath: string;
  warnings: string[];
};

/**
 * Load all agent outputs, merge them into a PublishBundle, validate, and save.
 */
export async function runBuild(topicId: string): Promise<BuildResult> {
  // 1) Load inputs
  const { inputs, warnings: loadWarnings } = await loadBuildInputs(topicId);

  // 2) Collect deck assets (PNGs)
  const topicOutputsDir = getTopicOutputsDir(topicId);
  const { deck, warnings: deckWarnings } = await collectDeckAssets({
    topicId,
    topicOutputsDir,
    contentPlanSlides: inputs.contentPlan.slides,
    manifestPath: inputs.deckManifestPath,
  });

  // 3) Build bundle
  const allWarnings = [...loadWarnings, ...deckWarnings];
  const { bundle, warnings: buildWarnings } = buildPublishBundle({
    topicId,
    topicIntel: inputs.topicIntel,
    contentPlan: inputs.contentPlan,
    captionDraft: inputs.captionDraft,
    validatedPost: inputs.validatedPost,
    deck,
    provenance: {
      topicIntelPath: inputs.topicIntelPath,
      contentPlanPath: inputs.contentPlanPath,
      agent2TopicPath: inputs.agent2TopicPath,
      deckManifestPath: inputs.deckManifestPath,
      validatedPostPath: inputs.validatedPostPath,
    },
    warnings: allWarnings,
  });

  const finalWarnings = buildWarnings;

  // 4) Validate via Zod
  parsePublishBundle(bundle);

  // 5) Save
  const savedPath = await savePublishBundle(topicId, bundle);

  return { bundle, savedPath, warnings: finalWarnings };
}
