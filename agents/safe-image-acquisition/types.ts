// ============================================================================
// 기본 타입 정의 (Basic Type Definitions)
// ============================================================================

/** 이미지 사용 목적 */
export type IntendedUse = "commercial" | "editorial";

/** 이미지 사용 채널 */
export type Channel = "instagram" | "web" | "print";

/** 이미지 변형 타입 */
export type Transform =
  | "resize"
  | "crop"
  | "text_overlay"
  | "composite"
  | "color_grade";

/** 포스트 채널 타입 */
export type PostChannel = "web" | "instagram" | "newsletter";

// ============================================================================
// 이미지 요청 및 후보 (Image Request & Candidates)
// ============================================================================

/** 이미지 카테고리 */
export type ImageCategory = "music" | "fashion" | "celebrity" | "issue";

/** 이미지 요청 브리프 - 사용자가 요청하는 이미지의 요구사항 */
export interface ImageBrief {
  topic: string;
  keywords: string[];
  intendedUse: IntendedUse;
  channel: Channel;
  requiresDerivative: boolean;
  allowPeople: boolean;
  allowLogos: boolean;
  targetTerritory?: string;
  category?: ImageCategory;
}

/** 원본 이미지 후보 - 제공자로부터 받은 초기 이미지 정보 */
export interface RawImageCandidate {
  id: string;
  provider: string;
  previewUrl: string;
  sourceUrl: string;
  author?: string;
  width: number;
  height: number;
}

// ============================================================================
// 라이선스 및 권한 (License & Permissions)
// ============================================================================

/** 라이선스 프로필 - 이미지의 사용 권한 및 제약사항 */
export interface LicenseProfile {
  provider: string;
  sourceUrl: string;
  licenseUrl?: string;
  licenseText?: string;

  allowedUses: IntendedUse[];
  allowedChannels: Channel[] | "any";
  territory: "worldwide" | string[];
  expiry?: string;

  derivatives: {
    allowed: boolean;
    allowedTransforms?: Transform[] | "any";
    prohibitedTransforms?: Transform[];
  };

  attribution: {
    required: boolean;
    textTemplate?: string;
  };

  modelRelease: "unknown" | "provided" | "not_provided";
  propertyRelease: "unknown" | "provided" | "not_provided";

  restrictions: {
    editorialOnly?: boolean;
    noCommercial?: boolean;
    noDerivatives?: boolean;
    noAITraining?: boolean;
    sensitiveUseProhibited?: boolean;
    trademarkRestricted?: boolean;
  };

  confidence: "high" | "medium" | "low";
}

// ============================================================================
// 자산 역할 및 검증 (Asset Role & Validation)
// ============================================================================

/** 자산 역할 - 이미지가 사용될 용도 */
export type AssetRole =
  | "background_editable"
  | "hero_unedited"
  | "evidence_only";

/** 위험 플래그 - 이미지에 포함된 잠재적 위험 요소 */
export interface RiskFlags {
  containsPerson: boolean;
  containsLogo: boolean;
  hasWatermark: boolean;
  celebrityLikelihood: boolean;
}

/** 검증된 자산 - 모든 검증을 통과한 최종 이미지 자산 */
export interface ValidatedAsset {
  assetId: string;
  provider: string;
  localPath: string;
  sourceUrl: string;
  license: LicenseProfile;
  proof: {
    capturedAt: string;
    sourceHash: string;
    licenseHash?: string;
  };
  risk: {
    flags: RiskFlags;
    riskScore: number;
  };
  role: AssetRole;
  recommendedAttribution?: string;
}

// ============================================================================
// 저작권 표시 (Attribution)
// ============================================================================

/** 저작권 표시 라인 - 개별 이미지의 저작권 정보 */
export interface AttributionLine {
  assetId: string;
  provider: string;
  role: AssetRole;
  text: string;
}

/** 저작권 표시 번들 - 포스트 전체의 저작권 표시 정보 */
export interface AttributionBundle {
  captionAppendix: string;
  footerCredits: AttributionLine[];
  perImageCredits: AttributionLine[];
}

// ============================================================================
// 포스트 컴플라이언스 (Post Compliance)
// ============================================================================

/** 포스트 컴플라이언스 결과 - 포스트 사용 가능 여부 및 요구사항 */
export interface PostComplianceResult {
  postUseIntent: IntendedUse;
  channel: PostChannel;
  images: ValidatedAsset[];
  overallRiskScore: number;
  allowed: boolean;
  requiredActions: string[];
  attributionRequired: boolean;
  notes: string[];
  attribution?: AttributionBundle;
}
