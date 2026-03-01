// ============================================================================
// ContentPlan — Agent3 output contract
// ============================================================================

export interface ContentSlide {
  kind:
    | "cover"
    | "fact"
    | "summary"
    | "cta"
    | "credits"
    // Music-specific slide kinds
    | "album_cover"
    | "tracklist"
    | "meme"
    | "album_grid"
    | "concert_info";
  headline: string;
  bullets?: string[];
  note?: string;
  evidenceUrls?: string[];

  // Music-specific optional fields
  albumRef?: SpotifyAlbumRef;
  memeText?: string;
  concertDetails?: {
    venue: string;
    date: string;
    lineup: string[];
  };
}

/** Spotify album reference (shared with Studio types) */
export interface SpotifyAlbumRef {
  spotifyId: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseDate?: string;
}

export interface ContentCreditsSource {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
}

export interface ContentPlan {
  topicId: string;
  title: string;
  subtitle?: string;
  category: "music" | "lifestyle";
  depth: "news" | "explainer" | "analysis";
  slides: ContentSlide[];
  hashtags: string[];
  credits: {
    sources: ContentCreditsSource[];
  };
  createdAt: string;
}

// ============================================================================
// Minimal input types (subset of Agent5 contracts)
// ============================================================================

export interface IntelSource {
  title: string;
  publisher?: string;
  url: string;
  publishedAt?: string;
}

export interface IntelKeyFact {
  text: string;
  evidenceUrls: string[];
}

export interface TopicIntelInput {
  topicId: string;
  normalizedTopic: string;
  category: string;
  angleCandidates: string[];
  sources: IntelSource[];
  keyFacts: IntelKeyFact[];
  imageQueries: string[];
  riskNotes: string[];
  createdAt: string;
}

export interface TopicRequestInput {
  seedKeyword: string;
  depth?: "news" | "explainer" | "analysis";
}

// ============================================================================
// Agent2TopicPackage — Bridge contract (ContentPlan → Agent2 TopicPackage)
// ============================================================================

export interface Agent2TopicPackage {
  title: string;
  subtitle?: string;
  category: string;
  keyFacts?: string[];
  hashtags?: string[];
}
