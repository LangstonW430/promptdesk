-- AlterTable: add nullable rating column to generated_prompts
-- 1 = thumbs up, -1 = thumbs down, NULL = not rated
ALTER TABLE "generated_prompts" ADD COLUMN "rating" INTEGER;
