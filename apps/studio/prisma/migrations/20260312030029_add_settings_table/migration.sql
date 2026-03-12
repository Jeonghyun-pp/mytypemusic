-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "llm_usage_logs" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "caller" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_gen_history" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "revisedPrompt" TEXT,
    "provider" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT 'square',
    "purpose" TEXT NOT NULL DEFAULT 'general',
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_gen_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_logs_createdAt_idx" ON "llm_usage_logs"("createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_logs_caller_idx" ON "llm_usage_logs"("caller");

-- CreateIndex
CREATE INDEX "llm_usage_logs_model_idx" ON "llm_usage_logs"("model");

-- CreateIndex
CREATE INDEX "image_gen_history_provider_idx" ON "image_gen_history"("provider");

-- CreateIndex
CREATE INDEX "image_gen_history_createdAt_idx" ON "image_gen_history"("createdAt");

-- AddForeignKey
ALTER TABLE "autopilot_proposals" ADD CONSTRAINT "autopilot_proposals_autopilotConfigId_fkey" FOREIGN KEY ("autopilotConfigId") REFERENCES "autopilot_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
