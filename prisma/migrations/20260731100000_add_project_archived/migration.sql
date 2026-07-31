-- Archiving for projects.
--
-- A separate flag from `status` rather than a new status value: status records
-- where the work stands (active / completed / on_hold / cancelled) and
-- archiving records whether the project should still show up in working views.
-- Folding archiving into status would lose the completed-vs-cancelled
-- distinction the moment a project was archived. This mirrors clients.is_archived.

ALTER TABLE "projects"
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- Every project list is owner-scoped and filters on the archived flag.
CREATE INDEX "projects_owner_archived_idx" ON "projects"("owner_id", "is_archived");
