import { type NextRequest, NextResponse } from 'next/server'

// Retrieval + scoring + budgeting can take >10 s on a cold start with a large
// pipeline. Raise the Vercel serverless function timeout to 30 s.
export const maxDuration = 30
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { generatePrompt } from '@/lib/prompts'

const generateSchema = z.object({
  template_key: z.string().min(1),
  scope: z.enum(['global', 'client', 'notes']),
  client_id: z.string().uuid().optional(),
  objective: z.string().max(500).optional(),
})

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function serverError(err: unknown) {
  console.error('[POST /api/prompts/generate]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function POST(req: NextRequest) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request')
  }

  const { template_key, scope, client_id, objective } = parsed.data

  // Client-scoped and notes-scoped templates require a client_id
  if ((scope === 'client' || scope === 'notes') && !client_id) {
    return badRequest('client_id is required for client and notes scope')
  }

  try {
    const result = await generatePrompt(ownerId, {
      templateKey: template_key,
      scope,
      clientId: client_id,
      objective,
    })

    return NextResponse.json({
      text: result.text,
      token_count: result.tokenCount,
      context_meta: result.contextMeta,
    })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Template not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    return serverError(err)
  }
}
