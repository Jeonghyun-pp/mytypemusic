import type { PublishBundle, Provenance } from "../contracts.js";
import type { BuildInputs } from "./loadInputs.js";
import type { DeckAssets } from "./collectDeckAssets.js";

// ============================================================================
// buildPublishBundle — merge all inputs into a single PublishBundle
// ============================================================================

export function buildPublishBundle(params: {
  topicId: string;
  topicIntel: BuildInputs["topicIntel"];
  contentPlan: BuildInputs["contentPlan"];
  captionDraft?: string;
  validatedPost?: BuildInputs["validatedPost"];
  deck: DeckAssets;
  provenance: Provenance;
  warnings?: string[];
}): { bundle: PublishBundle; warnings: string[] } {
  const {
    topicId,
    topicIntel,
    contentPlan,
    captionDraft,
    validatedPost,
    deck,
    provenance,
  } = params;
  const warnings = [...(params.warnings ?? [])];

  // ---- category ----
  const category: "music" | "lifestyle" =
    contentPlan.category === "music" ? "music" : "lifestyle";

  // ---- region ----
  const region = topicIntel.region ?? "KR";

  // ---- caption ----
  let captionText: string;
  if (captionDraft !== undefined && captionDraft.length > 0) {
    captionText = captionDraft;
  } else {
    captionText = "";
    warnings.push("No caption draft available — caption.text is empty");
  }

  // ---- compliance.riskNotes (deduplicated) ----
  const riskSet = new Set<string>();
  if (topicIntel.riskNotes) {
    for (const n of topicIntel.riskNotes) riskSet.add(n);
  }
  if (validatedPost?.riskNotes) {
    for (const n of validatedPost.riskNotes) riskSet.add(n);
  }
  const riskNotes = [...riskSet];

  // ---- compliance.attribution ----
  const attribution: PublishBundle["compliance"]["attribution"] = {};
  if (validatedPost?.attribution) {
    if (validatedPost.attribution.captionAppendix) {
      attribution.captionAppendix = validatedPost.attribution.captionAppendix;
    }
    if (validatedPost.attribution.footerCredits) {
      attribution.footerCredits = validatedPost.attribution.footerCredits;
    }
    if (
      validatedPost.attribution.perImageCredits &&
      validatedPost.attribution.perImageCredits.length > 0
    ) {
      attribution.perImageCredits = validatedPost.attribution.perImageCredits;
    }
  }

  // ---- compliance.sources ----
  const sources =
    contentPlan.credits.sources.length > 0
      ? contentPlan.credits.sources
      : topicIntel.sources;

  // ---- assemble ----
  const bundle: PublishBundle = {
    topicId,
    category,
    region,
    title: contentPlan.title,
    subtitle: contentPlan.subtitle,

    deck: {
      size: deck.size,
      format: deck.format,
      slides: deck.slides,
      manifestPath: deck.manifestPath,
    },

    caption: {
      text: captionText,
      hashtags: contentPlan.hashtags,
    },

    compliance: {
      riskNotes,
      attribution,
      sources,
    },

    provenance,

    createdAt: new Date().toISOString(),
    version: "1.0",
  };

  return { bundle, warnings };
}
