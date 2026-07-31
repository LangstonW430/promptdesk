-- Indexes backing the owner-scoped list queries that drive the main nav routes.
-- Each of these filters on owner_id and orders by a timestamp, which without a
-- matching composite index means a scan plus a sort on every page load.

-- listProjects: where owner_id order by updated_at desc
CREATE INDEX "projects_owner_updated_idx" ON "projects"("owner_id", "updated_at" DESC);

-- listInvoices: where owner_id order by created_at desc
CREATE INDEX "invoices_owner_created_idx" ON "invoices"("owner_id", "created_at" DESC);

-- listForms: where owner_id order by updated_at desc
CREATE INDEX "forms_owner_updated_idx" ON "forms"("owner_id", "updated_at" DESC);

-- listClients / fetchClientsForPicker / prompt context: the archived filter is
-- applied on nearly every client read, and clients are ordered by updated_at.
CREATE INDEX "clients_owner_archived_updated_idx"
  ON "clients"("owner_id", "is_archived", "updated_at" DESC);
