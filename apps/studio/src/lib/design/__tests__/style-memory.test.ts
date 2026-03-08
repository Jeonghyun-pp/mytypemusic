/**
 * Style Memory — Unit Test (no LLM required).
 */
import {
  saveStyleMemory,
  getStyleMemory,
  getStyleMemoryEntry,
  getArtistStyle,
  getArtistStyles,
  getRecentStyles,
  getStyleMemoryStats,
  clearStyleMemory,
  artistKey,
  albumKey,
} from "../style-memory";
import type { StyleToken } from "../types";

let passed = 0;
let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assert(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}: ${(e as Error).message}`);
  }
}

function makeToken(overrides: Partial<StyleToken> = {}): StyleToken {
  return {
    id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: "Test Style",
    colors: {
      palette: ["#6C5CE7", "#00CEC9", "#FD79A8"],
      ratios: [0.5, 0.3, 0.2],
      gradient: "linear-gradient(135deg, #6C5CE7, #00CEC9)",
    },
    typography: {
      mood: "sans_modern",
      weight: "bold",
      style: "sans",
    },
    layout: {
      density: "balanced",
      alignment: "center",
      whitespace: "moderate",
    },
    effects: ["gradient", "shadow"],
    moodKeywords: ["vibrant", "modern", "energetic"],
    ...overrides,
  };
}

console.log(`\nStyle Memory Unit Tests\n`);

clearStyleMemory();

const T_BASE = Date.now();

// Test 1
assert("save + get by key", () => {
  const token = makeToken({ name: "BTS Style" });
  saveStyleMemory({
    key: albumKey("album123"),
    token,
    source: "spotify_album_art",
    artistName: "BTS",
    albumName: "Proof",
    spotifyArtistId: "artist_bts",
    spotifyAlbumId: "album123",
    confidence: 0.9,
    extractedAt: new Date(T_BASE),
  });

  const got = getStyleMemory(albumKey("album123"));
  check(got !== undefined, "should find token");
  check(got!.name === "BTS Style", `name mismatch: ${got!.name}`);
});

// Test 2
assert("get entry with metadata", () => {
  const entry = getStyleMemoryEntry(albumKey("album123"));
  check(entry !== undefined, "should find entry");
  check(entry!.artistName === "BTS", "artist name");
  check(entry!.confidence === 0.9, "confidence");
  check(entry!.accessCount === 1, `access count should be 1, got ${entry!.accessCount}`);
});

// Test 3
assert("artist key lookup", () => {
  const token = makeToken({ name: "NewJeans Style" });
  saveStyleMemory({
    key: artistKey("artist_nj"),
    token,
    source: "spotify_album_art",
    artistName: "NewJeans",
    spotifyArtistId: "artist_nj",
    confidence: 0.85,
    extractedAt: new Date(T_BASE + 1000),
  });

  const got = getArtistStyle("artist_nj");
  check(got !== undefined, "should find by artist ID");
  check(got!.name === "NewJeans Style", "name");
});

// Test 4
assert("artist fallback to album", () => {
  // artist_bts doesn't have an artist-level entry, but has album entry
  const got = getArtistStyle("artist_bts");
  check(got !== undefined, "should fall back to album");
  check(got!.name === "BTS Style", "should find BTS album style");
});

// Test 5
assert("get all artist styles", () => {
  // Add another album for NewJeans
  saveStyleMemory({
    key: albumKey("album_nj2"),
    token: makeToken({ name: "NJ Album 2" }),
    source: "spotify_album_art",
    artistName: "NewJeans",
    spotifyArtistId: "artist_nj",
    spotifyAlbumId: "album_nj2",
    confidence: 0.8,
    extractedAt: new Date(T_BASE + 2000),
  });

  const styles = getArtistStyles("artist_nj");
  check(styles.length === 2, `expected 2, got ${styles.length}`);
});

// Test 6
assert("recent styles", () => {
  const recent = getRecentStyles(10);
  check(recent.length === 3, `expected 3, got ${recent.length}`);
  // Most recent first
  check(recent[0]!.key === albumKey("album_nj2"), "newest first");
});

// Test 7
assert("stats", () => {
  const stats = getStyleMemoryStats();
  check(stats.totalEntries === 3, `total entries: ${stats.totalEntries}`);
  check(stats.artistCount === 1, `artist count: ${stats.artistCount}`);
  check(stats.albumCount === 2, `album count: ${stats.albumCount}`);
  check(stats.hitRate > 0, "hit rate should be > 0");
});

// Test 8
assert("cache miss returns undefined", () => {
  const got = getStyleMemory("album:nonexistent");
  check(got === undefined, "should be undefined");
});

// Test 9
assert("clear memory", () => {
  clearStyleMemory();
  const stats = getStyleMemoryStats();
  check(stats.totalEntries === 0, "should be empty");
  check(stats.hitRate === 0, "hit rate reset");
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
