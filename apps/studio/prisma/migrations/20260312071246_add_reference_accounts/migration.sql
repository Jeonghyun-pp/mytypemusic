-- CreateTable
CREATE TABLE "reference_accounts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "username" TEXT NOT NULL,
    "platformUserId" TEXT,
    "displayName" TEXT NOT NULL DEFAULT '',
    "profileImageUrl" TEXT NOT NULL DEFAULT '',
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'artist',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_feeds" (
    "id" TEXT NOT NULL,
    "referenceAccountId" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'image',
    "permalink" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enrichedContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reference_accounts_platform_isActive_idx" ON "reference_accounts"("platform", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "reference_accounts_platform_username_key" ON "reference_accounts"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "reference_feeds_platformPostId_key" ON "reference_feeds"("platformPostId");

-- CreateIndex
CREATE INDEX "reference_feeds_referenceAccountId_timestamp_idx" ON "reference_feeds"("referenceAccountId", "timestamp");

-- CreateIndex
CREATE INDEX "reference_feeds_timestamp_idx" ON "reference_feeds"("timestamp");

-- AddForeignKey
ALTER TABLE "reference_feeds" ADD CONSTRAINT "reference_feeds_referenceAccountId_fkey" FOREIGN KEY ("referenceAccountId") REFERENCES "reference_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
