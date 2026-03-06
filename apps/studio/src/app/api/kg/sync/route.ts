import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";
import { syncArtistByName, syncArtistBySpotifyId, syncArtistsBatch } from "@/lib/pipeline/kg-sync";

/**
 * POST /api/kg/sync — Sync artist(s) from Spotify into Knowledge Graph.
 *
 * Body options:
 *   { "artistName": "NewJeans" }              — sync single artist by name
 *   { "spotifyId": "6HvZYsbFfjnjFrWF950C9d" } — sync single artist by Spotify ID
 *   { "artistNames": ["NewJeans", "aespa"] }  — sync batch by names
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.spotifyId) {
      const result = await syncArtistBySpotifyId(body.spotifyId as string);
      return json(result, 200);
    }

    if (body.artistName) {
      const result = await syncArtistByName(body.artistName as string);
      if (!result) return json({ error: "Artist not found on Spotify" }, 404);
      return json(result, 200);
    }

    if (body.artistNames && Array.isArray(body.artistNames)) {
      const names = body.artistNames as string[];
      if (names.length > 20) return badRequest("Max 20 artists per batch");
      const results = await syncArtistsBatch(names);
      return json({ results, synced: results.filter(Boolean).length, total: names.length }, 200);
    }

    return badRequest("Provide artistName, spotifyId, or artistNames[]");
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * GET /api/kg/sync — List synced artists with stats.
 */
export async function GET() {
  try {
    const artists = await prisma.musicArtist.findMany({
      orderBy: { popularity: "desc" },
      select: {
        id: true,
        name: true,
        nameKo: true,
        spotifyId: true,
        genres: true,
        popularity: true,
        followers: true,
        imageUrl: true,
        lastSyncedAt: true,
        _count: { select: { albums: true, relationsFrom: true } },
      },
    });

    const totalAlbums = await prisma.musicAlbum.count();
    const totalTracks = await prisma.musicTrack.count();
    const totalRelations = await prisma.artistRelation.count();

    return json({
      artists,
      stats: {
        totalArtists: artists.length,
        totalAlbums,
        totalTracks,
        totalRelations,
      },
    });
  } catch (e) {
    return serverError(String(e));
  }
}
