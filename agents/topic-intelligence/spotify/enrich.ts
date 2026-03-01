import type { TopicIntelPack, TopicSource, TopicKeyFact } from "../contracts.js";
import type { SpotifyDataPack } from "./types.js";
import { saveJson } from "../io/save.js";
import { getSpotifyDataPath } from "../io/paths.js";

// ============================================================================
// Spotify → TopicIntelPack Enrichment
//
// Merges Spotify metadata into an existing TopicIntelPack:
// - sources: Spotify album/artist URLs
// - keyFacts: release date, track count, popularity, genres
// - imageQueries: album/artist keywords
// - angleCandidates: music-specific angles
//
// The raw SpotifyDataPack is also saved as spotify-data.json.
// ============================================================================

export async function enrichTopicWithSpotify(
  pack: TopicIntelPack,
  spotify: SpotifyDataPack,
): Promise<TopicIntelPack> {
  const enriched = { ...pack };

  // 1. Add Spotify sources
  const spotifySources = buildSpotifySources(spotify);
  enriched.sources = [...pack.sources, ...spotifySources];

  // 2. Add Spotify-based key facts
  const spotifyFacts = buildSpotifyKeyFacts(spotify);
  enriched.keyFacts = [...pack.keyFacts, ...spotifyFacts];

  // 3. Add image queries from Spotify metadata
  const spotifyImageQueries = buildSpotifyImageQueries(spotify);
  enriched.imageQueries = [...pack.imageQueries, ...spotifyImageQueries];

  // 4. Add music-specific angle candidates
  const spotifyAngles = buildSpotifyAngles(spotify);
  enriched.angleCandidates = [...pack.angleCandidates, ...spotifyAngles];

  // 5. Save raw SpotifyDataPack alongside other topic outputs
  const spotifyDataPath = getSpotifyDataPath(pack.topicId);
  await saveJson(spotifyDataPath, spotify);

  return enriched;
}

// ── Source builders ─────────────────────────────────────────

function buildSpotifySources(spotify: SpotifyDataPack): TopicSource[] {
  const sources: TopicSource[] = [];

  for (const album of spotify.albums ?? []) {
    sources.push({
      title: `[Spotify] ${album.name} — ${album.artists.map((a) => a.name).join(", ")}`,
      publisher: "Spotify",
      url: album.external_urls.spotify,
      publishedAt: album.release_date,
    });
  }

  for (const artist of spotify.artists ?? []) {
    sources.push({
      title: `[Spotify] ${artist.name} (Artist Profile)`,
      publisher: "Spotify",
      url: artist.external_urls.spotify,
    });
  }

  return sources;
}

// ── Key fact builders ───────────────────────────────────────

function buildSpotifyKeyFacts(spotify: SpotifyDataPack): TopicKeyFact[] {
  const facts: TopicKeyFact[] = [];

  // Album facts
  for (const album of spotify.albums ?? []) {
    const parts: string[] = [];

    if (album.release_date) {
      parts.push(`발매일: ${album.release_date}`);
    }
    if (album.total_tracks) {
      parts.push(`총 ${String(album.total_tracks)}곡 수록`);
    }
    if (album.album_type) {
      parts.push(`타입: ${album.album_type}`);
    }

    if (parts.length > 0) {
      const text = `${album.name} — ${parts.join(", ")} (Spotify)`;
      if (text.length >= 20) {
        facts.push({
          text,
          evidenceUrls: [album.external_urls.spotify],
        });
      }
    }
  }

  // Artist facts
  for (const artist of spotify.artists ?? []) {
    const parts: string[] = [];

    if (artist.genres.length > 0) {
      parts.push(`장르: ${artist.genres.slice(0, 3).join(", ")}`);
    }
    if (artist.popularity > 0) {
      parts.push(`Spotify 인기도 ${String(artist.popularity)}/100`);
    }
    if (artist.followers.total > 0) {
      parts.push(`팔로워 ${formatNumber(artist.followers.total)}명`);
    }

    if (parts.length > 0) {
      const text = `${artist.name} — ${parts.join(", ")} (Spotify)`;
      if (text.length >= 20) {
        facts.push({
          text,
          evidenceUrls: [artist.external_urls.spotify],
        });
      }
    }
  }

  // Track popularity facts (top tracks only)
  const topTracks = (spotify.tracks ?? [])
    .filter((t) => t.popularity >= 70)
    .slice(0, 3);

  for (const track of topTracks) {
    const text = `인기곡: ${track.name} — Spotify 인기도 ${String(track.popularity)}/100, ${formatDuration(track.duration_ms)}`;
    if (text.length >= 20) {
      facts.push({
        text,
        evidenceUrls: [track.external_urls.spotify],
      });
    }
  }

  return facts;
}

// ── Image query builders ────────────────────────────────────

function buildSpotifyImageQueries(spotify: SpotifyDataPack): string[] {
  const queries: string[] = [];

  for (const artist of spotify.artists ?? []) {
    queries.push(`${artist.name} artist photo`);
    queries.push(`${artist.name} concert live`);
  }

  for (const album of (spotify.albums ?? []).slice(0, 3)) {
    const artistName = album.artists[0]?.name ?? "";
    queries.push(`${artistName} ${album.name} album`);
  }

  return queries;
}

// ── Angle builders ──────────────────────────────────────────

function buildSpotifyAngles(spotify: SpotifyDataPack): string[] {
  const angles: string[] = [];
  const intent = spotify.intent;

  switch (intent.intentType) {
    case "album_detail":
    case "new_releases":
      angles.push("신보 리뷰: 트랙리스트 분석 및 핵심 수록곡 소개");
      angles.push("음악적 변화: 이전 앨범 대비 달라진 점");
      break;

    case "top_tracks":
      angles.push("대표곡 분석: 인기곡들의 공통 특성과 매력 포인트");
      break;

    case "artist_compare":
      angles.push("아티스트 비교: 음악 스타일, 인기도, 장르 차이점");
      break;

    case "artist_profile":
      angles.push("아티스트 심층 프로필: 장르, 활동 이력, 음악 세계관");
      break;

    case "discography":
      angles.push("디스코그래피 타임라인: 음악적 성장과 변화 흐름");
      break;

    case "track_analysis":
      angles.push("트랙 오디오 분석: BPM, 에너지, 분위기 특성 시각화");
      break;

    case "related_artists":
      angles.push("관련 아티스트 맵: 비슷한 음악을 찾아서");
      break;

    case "mood_playlist":
      angles.push("무드 큐레이션: 분위기별 추천곡 모음");
      break;
  }

  return angles;
}

// ── Helpers ─────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}
