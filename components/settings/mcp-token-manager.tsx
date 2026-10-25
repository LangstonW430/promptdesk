'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible } from '@/components/ui/collapsible'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/prompts/copy-button'
import {
  createMcpTokenAction,
  revokeMcpTokenAction,
} from '@/lib/actions/mcp-tokens'
import type { McpTokenSummary } from '@/lib/mcp/tokens'
import { TOKEN_PLACEHOLDER, mcpClientSetups } from '@/lib/mcp/client-config'
import { McpClientSetupList, SetupBlock } from './mcp-client-setup'

interface McpTokenManagerProps {
  initialTokens: McpTokenSummary[]
  /** The app's canonical origin, used to build the endpoint URL in snippets. */
  appUrl: string
}

/**
 * Issue and revoke the access tokens an AI client uses to reach the MCP
 * server.
 *
 * The one non-obvious constraint: a freshly minted token is shown exactly
 * once, and it is held in local state taken from the action's return value.
 * It deliberately does not come from `initialTokens` — only the hash is
 * stored, so a re-read of the list can never contain it, and
 * `revalidatePath('/settings')` inside the action refreshes that list while
 * this component keeps the plaintext. It stays on screen until the user
 * dismisses it rather than fading on a timer, because the cost of losing it
 * is issuing another one.
 */
export function McpTokenManager({ initialTokens, appUrl }: McpTokenManagerProps) {
  const [tokens, setTokens] = useState<McpTokenSummary[]>(initialTokens)
  const [name, setName] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<McpTokenSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createMcpTokenAction({ name, canWrite })
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      setTokens((prev) => [result.token, ...prev])
      setFreshToken(result.plaintext)
      setName('')
      setCanWrite(false)
      setShowNewForm(false)
    })
  }

  function handleRevokeConfirmed() {
    const token = pendingRevoke
    if (!token) return
    setPendingRevoke(null)
    setError(null)
    startTransition(async () => {
      const result = await revokeMcpTokenAction(token.id)
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      setTokens((prev) => prev.map((t) => (t.id === token.id ? result.token : t)))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">MCP access tokens</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Let an AI client such as Claude Code read your client data directly,
            instead of copying generated prompts by hand.
          </p>
        </div>
        {!showNewForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="shrink-0"
          >
            <Plus />
            New token
          </Button>
        )}
      </div>

      {/*
        Said once, plainly, where it is relevant. There are no scopes in this
        phase: a token can read everything in the account.
      */}
      <p className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Every token can read everything in your account — clients, notes,
          tasks and financials. A token you also grant write access can add and
          change records, though it can never delete one. Treat a token like a
          password, and revoke it if a machine holding it is lost.
        </span>
      </p>

      <Collapsible
        title="How to connect your AI agent"
        description="Claude Code, Claude Desktop, Cursor or VS Code"
      >
        <p className="mb-4 text-xs text-muted-foreground">
          Replace{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            {TOKEN_PLACEHOLDER}
          </code>{' '}
          with a token you have saved. If you do not have one, create a token
          below — the full value is shown only once, and these snippets are
          filled in for you at that point.
        </p>
        <McpClientSetupList appUrl={appUrl} token={TOKEN_PLACEHOLDER} />
      </Collapsible>

      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border border-border p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-token-name">What is this token for?</Label>
            <Input
              id="mcp-token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Laptop — Claude Code"
              maxLength={100}
              autoFocus
            />
          </div>
          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={canWrite}
              onChange={(e) => setCanWrite(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-foreground"
            />
            <span className="text-sm">
              Let this token make changes
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Adds tools for logging notes, updating client details, and
                creating clients, projects and tasks. Your AI client will ask
                before each change. Nothing can be deleted either way. Leave
                this off for a token on a machine you share.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? 'Creating…' : 'Create token'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewForm(false)
                setName('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {freshToken && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/5 p-4">
          <div>
            <p className="text-sm font-medium">
              Copy your token now — it will not be shown again.
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Only a hash is stored, so this cannot be recovered. If you lose
              it, revoke it and create another.
            </p>
          </div>
          <code className="block overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
            {freshToken}
          </code>
          <div className="flex gap-2">
            <CopyButton text={freshToken} size="sm" />
          </div>

          {/*
            The setup snippets live here rather than only in the docs because
            this is the one moment the token exists outside the database. Once
            this block is dismissed the value is gone, so the thing to paste it
            into had better be on screen now.
          */}
          <div className="border-t border-emerald-500/30 pt-3">
            <SetupBlock
              setup={mcpClientSetups(appUrl, freshToken)[0]}
            />
          </div>

          <Collapsible
            title="Connect a different agent"
            description="Claude Desktop, Cursor or VS Code"
          >
            <div className="flex flex-col gap-5">
              {mcpClientSetups(appUrl, freshToken)
                .slice(1)
                .map((setup) => (
                  <SetupBlock key={setup.id} setup={setup} />
                ))}
            </div>
          </Collapsible>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFreshToken(null)}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {tokens.length === 0 && !showNewForm ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No tokens yet. Create one to connect an AI client.
        </p>
      ) : (
        tokens.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {token.name}
                    {token.canWrite && !token.revokedAt && (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                        Can make changes
                      </span>
                    )}
                    {token.revokedAt && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        Revoked
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {token.tokenHint}… · {describeLastUsed(token.lastUsedAt)}
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingRevoke(token)}
                    disabled={isPending}
                    aria-label={`Revoke token ${token.name}`}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null)
        }}
        title="Revoke this token?"
        description={
          pendingRevoke
            ? `Any AI client using "${pendingRevoke.name}" will stop working immediately. This cannot be undone — create a new token to reconnect.`
            : ''
        }
        confirmLabel="Revoke token"
        variant="destructive"
        onConfirm={handleRevokeConfirmed}
        isPending={isPending}
      />
    </div>
  )
}

/**
 * "Last used" is recorded at most once an hour per token, so this reads as
 * approximate rather than exact. Presenting an hour-old timestamp as a precise
 * one would mislead whoever is checking it after losing a laptop.
 */
function describeLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return 'never used'
  const date = new Date(lastUsedAt)
  return `last used around ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}
