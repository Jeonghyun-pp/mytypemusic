// ============================================================================
// PublishBundle — Single upload-ready artefact referencing all agent outputs
// ============================================================================

export interface DeckSlide {
  index: number;
  kind: "cover" | "fact" | "summary" | "cta" | "credits";
  filePath: string;
}

export interface Deck {
  size: { width: number; height: number };
  format: "png";
  slides: DeckSlide[];
  manifestPath?: string;
}

export interface Caption {
  text: string;
  hashtags: string[];
}

export interface PerImageCredit {
  localPath: string;
  creditLine: string;
}

export interface Attribution {
  captionAppendix?: string;
  footerCredits?: string;
  perImageCredits?: PerImageCredit[];
}

export interface ComplianceSource {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
}

export interface Compliance {
  riskNotes: string[];
  attribution: Attribution;
  sources: ComplianceSource[];
}

export interface Provenance {
  topicIntelPath?: string;
  contentPlanPath?: string;
  agent2TopicPath?: string;
  deckManifestPath?: string;
  validatedPostPath?: string;
}

export interface PublishBundle {
  topicId: string;
  category: "music" | "lifestyle";
  region: "KR" | "GLOBAL";
  title: string;
  subtitle?: string;

  deck: Deck;
  caption: Caption;
  compliance: Compliance;
  provenance: Provenance;

  createdAt: string;
  version: "1.0";
}
