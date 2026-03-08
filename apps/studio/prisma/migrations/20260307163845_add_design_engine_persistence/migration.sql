-- CreateTable
CREATE TABLE "style_memory_entries" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tokenJson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "artistName" TEXT NOT NULL DEFAULT '',
    "albumName" TEXT NOT NULL DEFAULT '',
    "spotifyArtistId" TEXT NOT NULL DEFAULT '',
    "spotifyAlbumId" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_quality_entries" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scoresJson" JSONB NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "iterationCount" INTEGER NOT NULL DEFAULT 1,
    "designPath" TEXT NOT NULL,
    "generationTimeMs" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_quality_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_performance_entries" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "templateId" TEXT,
    "designPath" TEXT NOT NULL,
    "typographyMood" TEXT,
    "layoutStyle" TEXT,
    "colorMood" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "slideCount" INTEGER NOT NULL DEFAULT 1,
    "impressions" INTEGER,
    "engagements" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "clicks" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_performance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "style_memory_entries_key_key" ON "style_memory_entries"("key");

-- CreateIndex
CREATE INDEX "style_memory_entries_spotifyArtistId_idx" ON "style_memory_entries"("spotifyArtistId");

-- CreateIndex
CREATE INDEX "style_memory_entries_lastAccessedAt_idx" ON "style_memory_entries"("lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "design_quality_entries_designId_key" ON "design_quality_entries"("designId");

-- CreateIndex
CREATE INDEX "design_quality_entries_contentType_idx" ON "design_quality_entries"("contentType");

-- CreateIndex
CREATE INDEX "design_quality_entries_verdict_idx" ON "design_quality_entries"("verdict");

-- CreateIndex
CREATE INDEX "design_quality_entries_createdAt_idx" ON "design_quality_entries"("createdAt");

-- CreateIndex
CREATE INDEX "style_performance_entries_contentType_platform_idx" ON "style_performance_entries"("contentType", "platform");

-- CreateIndex
CREATE INDEX "style_performance_entries_engagementRate_idx" ON "style_performance_entries"("engagementRate");

-- CreateIndex
CREATE INDEX "style_performance_entries_createdAt_idx" ON "style_performance_entries"("createdAt");
