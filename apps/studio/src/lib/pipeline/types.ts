// ── Pipeline shared types ──

export type ContentType = "blog" | "sns" | "carousel" | "review";

export type PipelineStatus =
  | "outlined"
  | "drafting"
  | "drafted"
  | "editing"
  | "reviewed"
  | "approved"
  | "failed";

/** Outline Agent output */
export interface PipelineOutline {
  title: string;
  angle: string;
  sections: Array<{ heading: string; keyPoints: string[] }>;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  targetWordCount: number;
}

/** 5-dimension quality rubric */
export interface QualityScore {
  factualAccuracy: number; // 0-100
  voiceAlignment: number; // 0-100
  readability: number; // 0-100
  originality: number; // 0-100
  seo: number; // 0-100
  overall: number; // weighted average
  feedback: string; // specific improvement suggestions
}

/** Editor Agent output */
export interface EditorResult {
  score: QualityScore;
  editedContent: string;
  passed: boolean;
  citationIssues?: string[];
}

/** A numbered citation reference */
export interface Citation {
  refNumber: number;
  title: string;
  url: string;
  snippet: string;
  sourceType: "web" | "knowledgeGraph" | "rag";
  accessedAt: string;
}

/** Research Agent output */
export interface ResearchPacket {
  topic: string;
  entities: {
    artists: string[];
    albums: string[];
    genres: string[];
    keywords: string[];
  };
  artists: Array<{
    name: string;
    nameKo: string;
    genres: string[];
    bio: string;
    popularity: number;
    albums: Array<{ title: string; releaseDate: string | null; albumType: string }>;
    relatedArtists: Array<{ name: string; relationType: string }>;
  }>;
  relatedArticles: Array<{
    content: string;
    sourceType: string;
    score: number;
  }>;
  webSources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

/** Full pipeline run result */
export interface PipelineResult {
  status: PipelineStatus;
  outline: PipelineOutline;
  draftContent: string;
  editedContent: string;
  qualityScore: QualityScore;
  rewriteCount: number;
  researchPacket?: ResearchPacket;
  citations?: Citation[];
  error?: string;
}

/** Content rules: things the persona must always/never do */
export interface ContentRules {
  always: string[];
  never: string[];
}

/** Persona context assembled for Writer Agent */
export interface PersonaContext {
  name: string;
  styleFingerprint: string;
  perspective: string;
  expertiseAreas: string[];
  tone: Record<string, unknown> | null;
  emotionalDrivers: string[];
  vocabulary: Record<string, unknown> | null;
  structure: Record<string, unknown> | null;
  contentRules: ContentRules | null;
  goldenExamples: Record<string, string[]> | null;
  channelProfiles: Record<string, unknown> | null;
}
