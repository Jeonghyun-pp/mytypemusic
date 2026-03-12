-- CreateTable
CREATE TABLE "topic_drafts" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT '',
    "reasoning" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT 'blog',
    "status" TEXT NOT NULL DEFAULT 'saved',
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceData" JSONB,
    "trendSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedEntities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formats" JSONB,
    "personaId" TEXT,
    "pipelineRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_messages" (
    "id" TEXT NOT NULL,
    "topicDraftId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicUpdate" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_drafts_pipelineRunId_key" ON "topic_drafts"("pipelineRunId");

-- CreateIndex
CREATE INDEX "topic_drafts_status_idx" ON "topic_drafts"("status");

-- CreateIndex
CREATE INDEX "topic_drafts_createdAt_idx" ON "topic_drafts"("createdAt");

-- CreateIndex
CREATE INDEX "topic_messages_topicDraftId_idx" ON "topic_messages"("topicDraftId");

-- AddForeignKey
ALTER TABLE "topic_drafts" ADD CONSTRAINT "topic_drafts_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_messages" ADD CONSTRAINT "topic_messages_topicDraftId_fkey" FOREIGN KEY ("topicDraftId") REFERENCES "topic_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
