import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ImageBriefSchema, ValidatedAssetSchema } from "./schema.js";
import type {
  ImageBrief,
  ValidatedAsset,
} from "./types.js";
import { createDefaultRegistry } from "./provider-registry.js";
import { normalizeLicense } from "./license-normalizer.js";
import { captureProof } from "./proof-capture.js";
import { validateUsage } from "./usage-validator.js";
import { calculateRisk } from "./risk-scoring.js";
import { DisabledVisionDetector } from "./vision-detector.js";
import { resolveAssetRole } from "./role-resolver.js";
import { buildRoutingPlan, providerTrackOf } from "./routing.js";
import { mapBriefToVisualConcept } from "./visual-concept-mapper.js";
import { ProviderError } from "./errors.js";

export type AcquireOptions = {
  category: "music" | "fashion" | "celebrity" | "issue";
  outputDir: string;
  maxCandidates?: number;
  maxProviderRetries?: number;
};

export async function safeAcquireImage(
  briefInput: unknown,
  options: AcquireOptions
): Promise<ValidatedAsset> {
  const maxCandidates = options.maxCandidates ?? 20;
  const brief: ImageBrief = {
    ...ImageBriefSchema.parse(briefInput),
    category: options.category,
  };

  const registry = createDefaultRegistry();
  const allProviders = registry.getProviders();

  if (allProviders.length === 0) {
    throw new ProviderError("No providers registered", {});
  }

  const plan = buildRoutingPlan(options.category);

  let totalFailures = 0;
  let lastReason = "";

  for (const track of plan.tracks) {
    const trackProviders = allProviders.filter((p) => {
      try {
        return providerTrackOf(p.name) === track;
      } catch {
        return false;
      }
    });

    for (const provider of trackProviders) {
    const effectiveBrief =
      track === "STOCK" || track === "AI"
        ? mapBriefToVisualConcept(brief, { category: options.category, track })
        : brief;

    let candidates;
    try {
      candidates = await provider.search(effectiveBrief);
    } catch {
      totalFailures++;
      lastReason = `provider_search_failed:${provider.name}`;
      continue;
    }

    const limitedCandidates = candidates.slice(0, maxCandidates);

    for (const candidate of limitedCandidates) {
      try {
        // 1) getLicenseInfo + normalize
        const rawLicense = await provider.getLicenseInfo(candidate);
        const license = normalizeLicense(rawLicense);

        // 2) captureProof
        let proof;
        try {
          proof = await captureProof(
            candidate.sourceUrl,
            license.licenseUrl
          );
        } catch {
          totalFailures++;
          lastReason = "proof_capture_failed";
          continue;
        }

        // 3) validateUsage
        try {
          validateUsage({ brief, license, proofAvailable: true });
        } catch {
          totalFailures++;
          lastReason = "usage_validation_failed";
          continue;
        }

        // 4) fetchAsset
        let assetData;
        try {
          assetData = await provider.fetchAsset(candidate);
        } catch {
          totalFailures++;
          lastReason = "fetch_asset_failed";
          continue;
        }

        // 5) vision analysis
        const vision = new DisabledVisionDetector();
        const flags = await vision.analyze(assetData.buffer);

        // 6) risk scoring
        const risk = calculateRisk({
          intendedUse: brief.intendedUse,
          license,
          flags,
          category: options.category,
          proofAvailable: true,
        });

        if (risk.shouldFail) {
          totalFailures++;
          lastReason = `risk_too_high:${risk.score}:${risk.reasons.join(",")}`;
          continue;
        }

        // 7) save to disk
        const assetId = crypto.randomUUID();
        await fs.mkdir(options.outputDir, { recursive: true });
        const localPath = path.join(options.outputDir, `${assetId}.jpg`);
        await fs.writeFile(localPath, assetData.buffer);

        // 8) build attribution
        let recommendedAttribution: string | undefined;
        if (license.attribution.required && license.attribution.textTemplate) {
          const author = candidate.author ?? "Unknown";
          recommendedAttribution = license.attribution.textTemplate.replace(
            /\{author\}/g,
            author
          );
        }

        // 9) build ValidatedAsset
        const asset: ValidatedAsset = {
          assetId,
          provider: provider.name,
          localPath,
          sourceUrl: candidate.sourceUrl,
          license,
          proof,
          risk: {
            flags,
            riskScore: risk.score,
          },
          role: resolveAssetRole(license),
          recommendedAttribution,
        };

        // 10) schema validate
        ValidatedAssetSchema.parse(asset);

        return asset;
      } catch (error: unknown) {
        totalFailures++;
        lastReason =
          error instanceof Error ? error.message : "unknown_candidate_error";
        continue;
      }
    }
    }
  }

  throw new ProviderError(
    `All providers and candidates exhausted (${totalFailures} failures)`,
    { failureCount: totalFailures, lastReason }
  );
}
