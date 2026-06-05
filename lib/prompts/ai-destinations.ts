export type AiDestinationKey = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'grok'

export interface AiDestination {
  key: AiDestinationKey
  label: string
  url: string
}

export const AI_DESTINATIONS: Record<AiDestinationKey, AiDestination> = {
  chatgpt: {
    key: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
  },
  claude: {
    key: 'claude',
    label: 'Claude',
    url: 'https://claude.ai/new',
  },
  gemini: {
    key: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com/app',
  },
  perplexity: {
    key: 'perplexity',
    label: 'Perplexity',
    url: 'https://www.perplexity.ai/',
  },
  grok: {
    key: 'grok',
    label: 'Grok',
    url: 'https://x.com/i/grok',
  },
}

export const AI_DESTINATION_ORDER: AiDestinationKey[] = [
  'chatgpt',
  'claude',
  'gemini',
  'perplexity',
  'grok',
]

export function isValidAiKey(key: string | null | undefined): key is AiDestinationKey {
  return key != null && key in AI_DESTINATIONS
}

/** Build a Gmail compose deep-link. `to` is optional; body is never included
 *  (prompts are too long for URL params). */
export function buildGmailUrl(to?: string): string {
  const base = 'https://mail.google.com/mail/?view=cm&fs=1'
  const params: string[] = []
  if (to) params.push(`to=${encodeURIComponent(to)}`)
  return params.length > 0 ? `${base}&${params.join('&')}` : base
}
