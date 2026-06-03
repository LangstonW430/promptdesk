'use client'

import { useState, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from '@/components/ui/button'

async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for non-HTTPS environments
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:absolute;left:-9999px;top:-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

type CopyState = 'idle' | 'copied' | 'error'

interface CopyButtonProps {
  text: string
  className?: string
  size?: VariantProps<typeof buttonVariants>['size']
}

export function CopyButton({ text, className, size = 'default' }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')

  const handleCopy = useCallback(async () => {
    try {
      await writeToClipboard(text)
      setState('copied')
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 2000)
    }
  }, [text])

  return (
    <Button
      variant={state === 'copied' ? 'secondary' : 'outline'}
      size={size}
      onClick={handleCopy}
      className={cn('gap-1.5', className)}
      aria-label={state === 'copied' ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
    >
      {state === 'copied' ? (
        <>
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy
        </>
      )}
    </Button>
  )
}
