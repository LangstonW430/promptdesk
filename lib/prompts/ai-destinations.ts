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
