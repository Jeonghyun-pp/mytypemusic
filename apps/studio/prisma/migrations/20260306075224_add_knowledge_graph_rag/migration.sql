-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "pipeline_runs" ADD COLUMN     "researchJson" JSONB;

-- CreateTable
CREATE TABLE "music_artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL DEFAULT 'person',
    "spotifyId" TEXT,
    "musicBrainzId" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT NOT NULL DEFAULT '',
    "bioKo" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "activeFrom" TEXT,
    "activeTo" TEXT,
    "country" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_albums" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleKo" TEXT NOT NULL DEFAULT '',
    "artistId" TEXT NOT NULL,
    "spotifyId" TEXT,
    "musicBrainzId" TEXT,
    "releaseDate" TEXT,
    "albumType" TEXT NOT NULL DEFAULT 'album',
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL DEFAULT '',
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "avgDanceability" DOUBLE PRECISION,
    "avgEnergy" DOUBLE PRECISION,
    "avgValence" DOUBLE PRECISION,
    "avgTempo" DOUBLE PRECISION,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "spotifyId" TEXT,
    "trackNumber" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "previewUrl" TEXT,
    "danceability" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "valence" DOUBLE PRECISION,
    "tempo" DOUBLE PRECISION,
    "acousticness" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_relations" (
    "id" TEXT NOT NULL,
    "fromArtistId" TEXT NOT NULL,
    "toArtistId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" TEXT NOT NULL DEFAULT 'spotify',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL DEFAULT '',
    "parentGenre" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_chunks" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "personaId" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "artistMentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "music_artists_spotifyId_key" ON "music_artists"("spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "music_artists_musicBrainzId_key" ON "music_artists"("musicBrainzId");

-- CreateIndex
CREATE INDEX "music_artists_spotifyId_idx" ON "music_artists"("spotifyId");

-- CreateIndex
CREATE INDEX "music_artists_name_idx" ON "music_artists"("name");

-- CreateIndex
CREATE UNIQUE INDEX "music_albums_spotifyId_key" ON "music_albums"("spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "music_albums_musicBrainzId_key" ON "music_albums"("musicBrainzId");

-- CreateIndex
CREATE INDEX "music_albums_artistId_idx" ON "music_albums"("artistId");

-- CreateIndex
CREATE INDEX "music_albums_releaseDate_idx" ON "music_albums"("releaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "music_tracks_spotifyId_key" ON "music_tracks"("spotifyId");

-- CreateIndex
CREATE INDEX "music_tracks_albumId_idx" ON "music_tracks"("albumId");

-- CreateIndex
CREATE INDEX "artist_relations_fromArtistId_idx" ON "artist_relations"("fromArtistId");

-- CreateIndex
CREATE INDEX "artist_relations_toArtistId_idx" ON "artist_relations"("toArtistId");

-- CreateIndex
CREATE UNIQUE INDEX "artist_relations_fromArtistId_toArtistId_relationType_key" ON "artist_relations"("fromArtistId", "toArtistId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "music_genres_name_key" ON "music_genres"("name");

-- CreateIndex
CREATE INDEX "article_chunks_sourceType_idx" ON "article_chunks"("sourceType");

-- CreateIndex
CREATE INDEX "article_chunks_personaId_idx" ON "article_chunks"("personaId");

-- AddForeignKey
ALTER TABLE "music_albums" ADD CONSTRAINT "music_albums_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "music_artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "music_albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_relations" ADD CONSTRAINT "artist_relations_fromArtistId_fkey" FOREIGN KEY ("fromArtistId") REFERENCES "music_artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_relations" ADD CONSTRAINT "artist_relations_toArtistId_fkey" FOREIGN KEY ("toArtistId") REFERENCES "music_artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
