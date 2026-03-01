// ============================================================================
// PostType System — shared type definitions for music magazine pipeline
// ============================================================================

export type PostType =
  | "album_release"        // 신보 알림 (FULL AUTO, 게시 전 승인만)
  | "album_recommendation" // 추천 리스트 (사람이 앨범 선택)
  | "concert_info"         // 공연 정보 (사람이 상세 입력)
  | "meme"                 // 밈 (사람이 텍스트 작성)
  | "artist_spotlight"     // 아티스트 소개 (반자동)
  | "curated_playlist"     // 플레이리스트 (사람이 선곡)
  | "general_cardnews";    // 기존 플로우 (하위호환)

export type AutomationLevel = "full" | "semi" | "human_driven";

export type ImageStrategy =
  | "spotify_album"
  | "pressroom_artist"
  | "stock"
  | "user_provided"
  | "mixed";

export interface CheckpointDef {
  afterStep: string;           // 어떤 스텝 이후에 멈출지
  type: "approval" | "input";  // 승인만 vs 입력 필요
  inputFields?: string[];      // input 타입일 때 필요한 필드
}

export interface PostTypeConfig {
  postType: PostType;
  automationLevel: AutomationLevel;
  requiresTopicIntel: boolean;
  requiresHumanInput: boolean;
  templateFamily: string;
  imageStrategy: ImageStrategy;
  defaultSlideCount: number;
  checkpoints: CheckpointDef[];
}

// ============================================================================
// PostType Config Registry
// ============================================================================

export const POST_TYPE_CONFIGS: Record<PostType, PostTypeConfig> = {
  album_release: {
    postType: "album_release",
    automationLevel: "full",
    requiresTopicIntel: true,
    requiresHumanInput: false,
    templateFamily: "music.album",
    imageStrategy: "spotify_album",
    defaultSlideCount: 5,
    checkpoints: [
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  album_recommendation: {
    postType: "album_recommendation",
    automationLevel: "human_driven",
    requiresTopicIntel: false,
    requiresHumanInput: true,
    templateFamily: "music.album",
    imageStrategy: "spotify_album",
    defaultSlideCount: 6,
    checkpoints: [
      { afterStep: "topic_request", type: "input", inputFields: ["selectedAlbums"] },
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  concert_info: {
    postType: "concert_info",
    automationLevel: "human_driven",
    requiresTopicIntel: false,
    requiresHumanInput: true,
    templateFamily: "music.concert",
    imageStrategy: "pressroom_artist",
    defaultSlideCount: 3,
    checkpoints: [
      { afterStep: "topic_request", type: "input", inputFields: ["concertVenue", "concertDate", "concertLineup"] },
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  meme: {
    postType: "meme",
    automationLevel: "human_driven",
    requiresTopicIntel: false,
    requiresHumanInput: true,
    templateFamily: "music.meme",
    imageStrategy: "pressroom_artist",
    defaultSlideCount: 1,
    checkpoints: [
      { afterStep: "image", type: "input", inputFields: ["memeText", "memePosition"] },
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  artist_spotlight: {
    postType: "artist_spotlight",
    automationLevel: "semi",
    requiresTopicIntel: true,
    requiresHumanInput: false,
    templateFamily: "music.album",
    imageStrategy: "mixed",
    defaultSlideCount: 5,
    checkpoints: [
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  curated_playlist: {
    postType: "curated_playlist",
    automationLevel: "human_driven",
    requiresTopicIntel: false,
    requiresHumanInput: true,
    templateFamily: "music.grid",
    imageStrategy: "spotify_album",
    defaultSlideCount: 4,
    checkpoints: [
      { afterStep: "topic_request", type: "input", inputFields: ["selectedAlbums", "playlistTitle"] },
      { afterStep: "agent2_render", type: "approval" },
    ],
  },

  general_cardnews: {
    postType: "general_cardnews",
    automationLevel: "full",
    requiresTopicIntel: true,
    requiresHumanInput: false,
    templateFamily: "cover",
    imageStrategy: "stock",
    defaultSlideCount: 6,
    checkpoints: [],
  },
};

// ============================================================================
// Helpers
// ============================================================================

export function getPostTypeConfig(postType: PostType): PostTypeConfig {
  return POST_TYPE_CONFIGS[postType];
}

export function isValidPostType(value: string): value is PostType {
  return value in POST_TYPE_CONFIGS;
}

/** Default PostType when none specified (backward compatibility) */
export const DEFAULT_POST_TYPE: PostType = "general_cardnews";
