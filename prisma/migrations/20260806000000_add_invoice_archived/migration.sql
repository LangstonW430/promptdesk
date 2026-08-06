-- Archiving for invoices.
--
-- A separate flag from `status` rather than a new status value: status records
-- where the invoice stands (draft / sent / paid / overdue) and archiving
-- records whether it should still show up in the working list. Folding
-- archiving into status would lose the paid-vs-draft distinction the moment an
-- invoice was archived, and `status` also drives the derived `overdue`
-- promotion at read time. This mirrors clients.is_archived and
-- projects.is_archived.

ALTER TABLE "invoices"
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- The invoice list is owner-scoped and filters on the archived flag.
CREATE INDEX "invoices_owner_archived_idx" ON "invoices"("owner_id", "is_archived");
