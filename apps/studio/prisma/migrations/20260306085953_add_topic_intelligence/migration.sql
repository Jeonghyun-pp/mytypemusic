-- CreateTable
CREATE TABLE "trend_snapshots" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "rank" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_performance" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "avgEngagement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPublishedAt" TIMESTAMP(3),
    "coolingUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trend_snapshots_source_fetchedAt_idx" ON "trend_snapshots"("source", "fetchedAt");

-- CreateIndex
CREATE INDEX "trend_snapshots_title_idx" ON "trend_snapshots"("title");

-- CreateIndex
CREATE UNIQUE INDEX "topic_performance_topic_category_key" ON "topic_performance"("topic", "category");
