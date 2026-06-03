'use client'

import { useState, useCallback } from 'react'
import type { GenerateResult } from './types'

export interface GeneratePayload {
  templateKey: string
  scope: 'global' | 'client' | 'notes'
  clientId?: string
  objective?: string
}

export interface UsePromptGeneratorReturn {
  result: GenerateResult | null
  loading: boolean
  error: string | null
  generate: (payload: GeneratePayload) => Promise<void>
  clear: () => void
}

export function usePromptGenerator(): UsePromptGeneratorReturn {
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (payload: GeneratePayload) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: payload.templateKey,
          scope: payload.scope,
          client_id: payload.clientId,
          objective: payload.objective,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate prompt')
        return
      }
      setResult({
        text: data.text,
        tokenCount: data.token_count,
        contextMeta: data.context_meta,
      })
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, generate, clear }
}
