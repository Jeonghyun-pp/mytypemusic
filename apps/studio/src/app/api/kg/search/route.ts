import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

/**
 * GET /api/kg/search?q=NewJeans — Search Knowledge Graph for artists/albums.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    if (!q) return badRequest("q parameter required");

    const artists = await prisma.musicArtist.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nameKo: { contains: q, mode: "insensitive" } },
          { aliases: { has: q } },
        ],
      },
      include: {
        albums: {
          orderBy: { releaseDate: "desc" },
          take: 5,
          select: { id: true, title: true, releaseDate: true, albumType: true, imageUrl: true },
        },
        relationsFrom: {
          include: { toArtist: { select: { id: true, name: true, imageUrl: true } } },
          take: 10,
        },
      },
      take: 10,
    });

    const albums = await prisma.musicAlbum.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { titleKo: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        artist: { select: { id: true, name: true } },
      },
      take: 10,
    });

    return json({ artists, albums });
  } catch (e) {
    return serverError(String(e));
  }
}
