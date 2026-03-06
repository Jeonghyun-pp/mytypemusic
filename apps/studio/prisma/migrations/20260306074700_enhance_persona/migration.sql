-- AlterTable
ALTER TABLE "writing_personas" ADD COLUMN     "channelProfiles" JSONB,
ADD COLUMN     "contentRules" JSONB,
ADD COLUMN     "emotionalDrivers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "expertiseAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "goldenExamples" JSONB,
ADD COLUMN     "perspective" TEXT NOT NULL DEFAULT '';
