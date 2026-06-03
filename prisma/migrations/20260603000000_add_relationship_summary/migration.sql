-- Add rolling relationship summary fields to clients table
ALTER TABLE "clients" ADD COLUMN "relationship_summary" TEXT;
ALTER TABLE "clients" ADD COLUMN "summary_updated_at" TIMESTAMPTZ(6);
