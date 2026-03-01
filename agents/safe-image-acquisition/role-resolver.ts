import type { LicenseProfile, AssetRole } from "./types.js";

export function resolveAssetRole(license: LicenseProfile): AssetRole {
  if (license.allowedUses.length === 0 || license.confidence === "low") {
    return "evidence_only";
  }

  if (license.derivatives.allowed) {
    return "background_editable";
  }

  if (license.restrictions.editorialOnly === true) {
    return "hero_unedited";
  }

  return "evidence_only";
}
