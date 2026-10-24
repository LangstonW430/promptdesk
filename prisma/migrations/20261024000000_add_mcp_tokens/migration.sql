-- MCP access tokens, and a marker for which surface asked for a prompt.

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_hint" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unique because it is the lookup key: every MCP request hashes the presented
-- bearer token and finds its row by this column alone.
CREATE UNIQUE INDEX "mcp_tokens_token_hash_key" ON "mcp_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_tokens_owner_created_idx" ON "mcp_tokens"("owner_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: mcp_tokens
-- Prisma connects as the table owner and bypasses this, as it does everywhere
-- else; the policy is here so the table is not the one gap in a schema where
-- every other owner-scoped table has one.
ALTER TABLE "mcp_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_tokens_owner" ON "mcp_tokens"
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- AlterTable
-- Defaulted rather than required: every prompt generated before the MCP
-- server existed came from the app, which is what the default says.
ALTER TABLE "generated_prompts" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'app';
