-- activities: dashboard recent-activity query + global prompt context fetch
-- Both filter by owner_id and order by created_at DESC; no index existed.
CREATE INDEX "activities_owner_created_idx" ON "activities"("owner_id", "created_at" DESC);

-- activities: getClientById includes activities per-client ordered by created_at.
-- The FK constraint alone does not create an index in Postgres.
CREATE INDEX "activities_client_created_idx" ON "activities"("client_id", "created_at" DESC);

-- tasks: prompt engine fetchContext queries open tasks by owner ordered by due_date.
CREATE INDEX "tasks_owner_done_due_idx" ON "tasks"("owner_id", "is_done", "due_date");

-- tasks: getClientById includes tasks per-client ordered by is_done, due_date.
CREATE INDEX "tasks_client_done_due_idx" ON "tasks"("client_id", "is_done", "due_date");
