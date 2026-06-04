-- Migration: add_finance_and_stripe
-- Adds: transactions table, stripe_sync_state table, stripe_customer_id on clients

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "stripe_customer_id" TEXT;

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT,
    "category" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "client_id" UUID,
    "external_id" TEXT,
    "external_type" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_sync_state" (
    "owner_id" UUID NOT NULL,
    "last_backfill_at" TIMESTAMPTZ(6),
    "last_event_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'idle',
    "last_error" TEXT,

    CONSTRAINT "stripe_sync_state_pkey" PRIMARY KEY ("owner_id")
);

-- CreateIndex
CREATE INDEX "transactions_owner_occurred_idx" ON "transactions"("owner_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_owner_type_idx" ON "transactions"("owner_id", "type");

-- CreateIndex
CREATE INDEX "transactions_client_idx" ON "transactions"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_owner_source_external_unique" ON "transactions"("owner_id", "source", "external_id");

-- CreateIndex
CREATE INDEX "clients_owner_stripe_customer_idx" ON "clients"("owner_id", "stripe_customer_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_sync_state" ADD CONSTRAINT "stripe_sync_state_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: enable and add owner-scoped policies for new tables
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_sync_state" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: owner access"
  ON transactions
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "stripe_sync_state: owner access"
  ON stripe_sync_state
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
