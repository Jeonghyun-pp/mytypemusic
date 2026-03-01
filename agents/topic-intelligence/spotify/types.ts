import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyTrack,
  SpotifyAudioFeatures,
} from "../../shared/spotify-client.js";

// ============================================================================
// Spotify Intent Types — natural language → structured API intent
// ============================================================================

export type SpotifyIntentType =
  | "album_detail"      // 특정 앨범 상세 (트랙리스트, 발매일 등)
  | "new_releases"      // 최신 발매 앨범 목록
  | "top_tracks"        // 아티스트 인기곡
  | "artist_compare"    // 아티스트 간 비교
  | "related_artists"   // 관련 아티스트 탐색
  | "mood_playlist"     // 분위기 기반 트랙 탐색
  | "discography"       // 아티스트 전체 디스코그래피
  | "track_analysis"    // 트랙 오디오 특성 분석
  | "artist_profile";   // 아티스트 프로필 (장르, 인기도 등)

export interface ParsedIntent {
  intentType: SpotifyIntentType;
  artistName?: string;
  albumName?: string;
  trackName?: string;
  compareWith?: string;       // artist_compare용
  mood?: string;              // mood_playlist용
  limit?: number;
  confidence: number;         // 0~1
  source: "rule" | "llm";    // 어떤 파서가 결정했는지
}

// ============================================================================
// SpotifyDataPack — fetched data bundle attached to TopicIntelPack
// ============================================================================

export interface SpotifyDataPack {
  intent: ParsedIntent;
  albums?: SpotifyAlbum[];
  artists?: SpotifyArtist[];
  tracks?: SpotifyTrack[];
  audioFeatures?: SpotifyAudioFeatures[];
  fetchedAt: string;          // ISO 8601
}
