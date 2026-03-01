export type TopicCategory = "music" | "lifestyle";
export type TopicDepth = "news" | "explainer" | "analysis";
export type TopicRegion = "KR" | "GLOBAL";
export interface TopicRequest {
  mode: "manual" | "auto";
  seedKeyword: string;
  category?: TopicCategory;
  depth?: TopicDepth;
  region?: TopicRegion;
  maxArticles?: number;
  recencyDays?: number;
  searchEntities?: string[];
}

export interface TopicSource {
  title: string;
  publisher?: string;
  url: string;
  publishedAt?: string;
}

export interface TopicKeyFact {
  text: string;
  evidenceUrls: string[];
}

export interface TopicIntelPack {
  topicId: string;
  normalizedTopic: string;
  category: string;
  angleCandidates: string[];
  sources: TopicSource[];
  keyFacts: TopicKeyFact[];
  imageQueries: string[];
  riskNotes: string[];
  createdAt: string;
}
