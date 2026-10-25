-- Write access for MCP tokens.
--
-- Defaults to false so every token issued before this migration keeps exactly
-- the permission it was issued with. The settings UI promised those tokens
-- could not change anything; widening them here would break that silently.
ALTER TABLE "mcp_tokens" ADD COLUMN "can_write" BOOLEAN NOT NULL DEFAULT false;
