-- CreateTable
CREATE TABLE "design_entries" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "imageDataUri" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "fontMood" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plans" (
    "id" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "frequency" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasoning" TEXT NOT NULL DEFAULT '',
    "addedToCalendar" BOOLEAN NOT NULL DEFAULT false,
    "calendarEventId" TEXT,
    "planId" TEXT NOT NULL,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_searches" (
    "id" TEXT NOT NULL,
    "imageDataUri" TEXT NOT NULL,
    "moodKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colorPalette" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atmosphere" TEXT NOT NULL DEFAULT '',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT NOT NULL DEFAULT '',
    "specJson" JSONB NOT NULL,
    "thumbnailDataUri" TEXT NOT NULL DEFAULT '',
    "planItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "slideComposition" JSONB,
    "writingStyle" JSONB,
    "visualDesign" JSONB,
    "insights" JSONB,
    "rawAnalysis" JSONB,
    "screenshots" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sns_accounts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "profileImageUrl" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL DEFAULT '',
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sns_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "jobPayload" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "snsAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_imports" (
    "id" TEXT NOT NULL,
    "urls" TEXT[],
    "commonInstructions" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "results" JSONB,
    "generatedPostIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_personas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creationMethod" TEXT NOT NULL,
    "sourceAccountId" TEXT,
    "tone" JSONB,
    "vocabulary" JSONB,
    "structure" JSONB,
    "topicPrefs" JSONB,
    "sampleTexts" JSONB,
    "styleFingerprint" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "snsAccountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "platformPostUrl" TEXT,
    "content" JSONB NOT NULL,
    "personaId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_performance" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_configs" (
    "id" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "personaId" TEXT,
    "platforms" TEXT[],
    "postsPerDay" INTEGER NOT NULL DEFAULT 1,
    "approvalMode" TEXT NOT NULL DEFAULT 'manual',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "topicKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_proposals" (
    "id" TEXT NOT NULL,
    "autopilotConfigId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publicationId" TEXT,
    "personaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incoming_messages" (
    "id" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "parentPostId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderHandle" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'comment',
    "body" TEXT NOT NULL,
    "classification" TEXT,
    "sentiment" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "isGoldenTime" BOOLEAN NOT NULL DEFAULT false,
    "autoReplied" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyText" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "incoming_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "replyTemplate" TEXT NOT NULL,
    "useAi" BOOLEAN NOT NULL DEFAULT false,
    "aiInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_campaigns" (
    "id" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "platforms" TEXT[],
    "commentMode" TEXT NOT NULL DEFAULT 'ai',
    "commentTemplate" TEXT,
    "aiInstructions" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10,
    "todayCount" INTEGER NOT NULL DEFAULT 0,
    "operatingStart" INTEGER NOT NULL DEFAULT 9,
    "operatingEnd" INTEGER NOT NULL DEFAULT 22,
    "minDelaySec" INTEGER NOT NULL DEFAULT 30,
    "maxDelaySec" INTEGER NOT NULL DEFAULT 300,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "tosWarningAcked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_comment_logs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "targetPostId" TEXT,
    "targetPostUrl" TEXT NOT NULL,
    "targetPostText" TEXT,
    "commentText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_comment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "snsAccountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "followersGrowth" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "demographics" JSONB,
    "topPosts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "seoKeywords" TEXT[],
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "personaId" TEXT,
    "pipelineRunId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT 'blog',
    "personaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "outlineJson" JSONB,
    "draftContent" TEXT,
    "editedContent" TEXT,
    "qualityScore" JSONB,
    "rewriteCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_entries_category_idx" ON "design_entries"("category");

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- CreateIndex
CREATE INDEX "plan_items_planId_idx" ON "plan_items"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "design_projects_planItemId_key" ON "design_projects"("planItemId");

-- CreateIndex
CREATE INDEX "design_projects_status_idx" ON "design_projects"("status");

-- CreateIndex
CREATE INDEX "design_projects_planItemId_idx" ON "design_projects"("planItemId");

-- CreateIndex
CREATE INDEX "benchmark_reports_createdAt_idx" ON "benchmark_reports"("createdAt");

-- CreateIndex
CREATE INDEX "sns_accounts_platform_idx" ON "sns_accounts"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "sns_accounts_platform_platformUserId_key" ON "sns_accounts"("platform", "platformUserId");

-- CreateIndex
CREATE INDEX "jobs_status_scheduledAt_idx" ON "jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cron_schedules_name_key" ON "cron_schedules"("name");

-- CreateIndex
CREATE INDEX "webhook_events_platform_processed_idx" ON "webhook_events"("platform", "processed");

-- CreateIndex
CREATE INDEX "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");

-- CreateIndex
CREATE INDEX "link_imports_status_idx" ON "link_imports"("status");

-- CreateIndex
CREATE INDEX "publications_status_idx" ON "publications"("status");

-- CreateIndex
CREATE INDEX "publications_scheduledAt_idx" ON "publications"("scheduledAt");

-- CreateIndex
CREATE INDEX "publications_snsAccountId_idx" ON "publications"("snsAccountId");

-- CreateIndex
CREATE INDEX "publications_personaId_idx" ON "publications"("personaId");

-- CreateIndex
CREATE INDEX "post_performance_snsAccountId_platform_idx" ON "post_performance"("snsAccountId", "platform");

-- CreateIndex
CREATE INDEX "post_performance_publishedAt_idx" ON "post_performance"("publishedAt");

-- CreateIndex
CREATE INDEX "autopilot_configs_snsAccountId_idx" ON "autopilot_configs"("snsAccountId");

-- CreateIndex
CREATE INDEX "autopilot_proposals_autopilotConfigId_idx" ON "autopilot_proposals"("autopilotConfigId");

-- CreateIndex
CREATE INDEX "autopilot_proposals_status_idx" ON "autopilot_proposals"("status");

-- CreateIndex
CREATE INDEX "incoming_messages_snsAccountId_isRead_idx" ON "incoming_messages"("snsAccountId", "isRead");

-- CreateIndex
CREATE INDEX "incoming_messages_classification_idx" ON "incoming_messages"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "incoming_messages_platform_externalId_key" ON "incoming_messages"("platform", "externalId");

-- CreateIndex
CREATE INDEX "auto_reply_rules_snsAccountId_idx" ON "auto_reply_rules"("snsAccountId");

-- CreateIndex
CREATE INDEX "keyword_campaigns_snsAccountId_idx" ON "keyword_campaigns"("snsAccountId");

-- CreateIndex
CREATE INDEX "keyword_comment_logs_campaignId_idx" ON "keyword_comment_logs"("campaignId");

-- CreateIndex
CREATE INDEX "keyword_comment_logs_status_idx" ON "keyword_comment_logs"("status");

-- CreateIndex
CREATE INDEX "analytics_snapshots_snsAccountId_platform_idx" ON "analytics_snapshots"("snsAccountId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_snsAccountId_date_key" ON "analytics_snapshots"("snsAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_pipelineRunId_key" ON "blog_posts"("pipelineRunId");

-- CreateIndex
CREATE INDEX "pipeline_runs_personaId_idx" ON "pipeline_runs"("personaId");

-- CreateIndex
CREATE INDEX "pipeline_runs_contentType_idx" ON "pipeline_runs"("contentType");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs"("status");

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "content_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
