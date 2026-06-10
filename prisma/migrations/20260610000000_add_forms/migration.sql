-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "public_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "submitter_name" TEXT,
    "submitter_email" TEXT,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_public_token_key" ON "forms"("public_token");

-- CreateIndex
CREATE INDEX "forms_owner_idx" ON "forms"("owner_id");

-- CreateIndex
CREATE INDEX "forms_project_idx" ON "forms"("project_id");

-- CreateIndex
CREATE INDEX "form_submissions_form_submitted_idx" ON "form_submissions"("form_id", "submitted_at" DESC);

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: forms
ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forms_owner" ON "forms"
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- RLS: form_submissions (owner can read all submissions for their forms)
ALTER TABLE "form_submissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_submissions_owner_read" ON "form_submissions"
  USING (
    form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())
  );

-- Allow unauthenticated inserts into form_submissions (public form submissions)
CREATE POLICY "form_submissions_public_insert" ON "form_submissions"
  FOR INSERT
  WITH CHECK (true);
