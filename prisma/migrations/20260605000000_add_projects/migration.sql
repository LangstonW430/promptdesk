-- Migration: add_projects
-- Adds: projects table, optional project_id on tasks

-- CreateTable
CREATE TABLE "projects" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "owner_id"     UUID           NOT NULL,
    "client_id"    UUID           NOT NULL,
    "title"        TEXT           NOT NULL,
    "status"       TEXT           NOT NULL DEFAULT 'active',
    "start_date"   DATE,
    "end_date"     DATE,
    "budget"       DECIMAL(12,2),
    "deliverables" JSONB          NOT NULL DEFAULT '[]',
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- AlterTable (non-breaking: nullable column, no default required)
ALTER TABLE "tasks" ADD COLUMN "project_id" UUID;

-- Indexes
CREATE INDEX "projects_owner_status_idx"  ON "projects"("owner_id", "status");
CREATE INDEX "projects_client_idx"        ON "projects"("client_id");
CREATE INDEX "tasks_project_done_due_idx" ON "tasks"("project_id", "is_done", "due_date");

-- Foreign keys
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: owner access"
  ON projects
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
