-- AlterTable
ALTER TABLE "pipeline_runs" ADD COLUMN     "contentQualityRatio" DOUBLE PRECISION,
ADD COLUMN     "engagementRate" DOUBLE PRECISION,
ADD COLUMN     "feedbackProcessedAt" TIMESTAMP(3),
ADD COLUMN     "feedbackStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "metrics1h" JSONB,
ADD COLUMN     "metrics24h" JSONB,
ADD COLUMN     "metrics30d" JSONB,
ADD COLUMN     "metrics7d" JSONB,
ADD COLUMN     "publicationId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pipeline_runs_feedbackStatus_idx" ON "pipeline_runs"("feedbackStatus");
