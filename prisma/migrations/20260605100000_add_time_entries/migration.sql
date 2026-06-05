-- Migration: add_time_entries
-- Adds: default_rate on clients, time_entries table

-- AlterTable: add default billing rate to clients
ALTER TABLE "clients" ADD COLUMN "default_rate" DECIMAL(10, 2);

-- CreateTable
CREATE TABLE "time_entries" (
    "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "owner_id"    UUID           NOT NULL,
    "client_id"   UUID           NOT NULL,
    "project_id"  UUID,
    "date"        DATE           NOT NULL,
    "hours"       DECIMAL(5, 2)  NOT NULL,
    "rate"        DECIMAL(10, 2),
    "description" TEXT,
    "is_billable" BOOLEAN        NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "time_entries_owner_date_idx"   ON "time_entries"("owner_id", "date" DESC);
CREATE INDEX "time_entries_client_date_idx"  ON "time_entries"("client_id", "date" DESC);
CREATE INDEX "time_entries_project_date_idx" ON "time_entries"("project_id", "date" DESC);

-- Foreign keys
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries: owner access"
  ON time_entries
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
