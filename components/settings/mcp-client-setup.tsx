'use client'

import { CopyButton } from '@/components/prompts/copy-button'
import { mcpClientSetups, type McpClientSetup } from '@/lib/mcp/client-config'

/**
 * How to point an AI client at this server.
 *
 * The snippets come from `lib/mcp/client-config.ts` rather than being written
 * out here, so the four shapes exist once and the tests can parse them. This
 * file is only the rendering.
 */

interface McpClientSetupProps {
  appUrl: string
  /** A real token when one was just created, or the placeholder otherwise. */
  token: string
}

export function McpClientSetupList({ appUrl, token }: McpClientSetupProps) {
  return (
    <div className="flex flex-col gap-5">
      {mcpClientSetups(appUrl, token).map((setup) => (
        <SetupBlock key={setup.id} setup={setup} />
      ))}
    </div>
  )
}

/** One client's snippet, on its own so the fresh-token callout can reuse it. */
export function SetupBlock({ setup }: { setup: McpClientSetup }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{setup.label}</p>
        <CopyButton text={setup.snippet} size="sm" className="shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground">{setup.location}</p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{setup.snippet}</code>
      </pre>
      <p className="text-xs text-muted-foreground">{setup.note}</p>
    </div>
  )
}
