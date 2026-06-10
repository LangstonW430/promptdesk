import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getFormByPublicToken, createFormSubmission } from '@/lib/forms'

const submitSchema = z.object({
  submitterName:  z.string().max(200).optional(),
  submitterEmail: z.string().email().max(300).optional(),
  answers:        z.record(z.string(), z.unknown()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params

  const form = await getFormByPublicToken(publicToken)
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Validate required fields
  for (const field of form.fields) {
    if (field.required) {
      const val = parsed.data.answers[field.id]
      if (val === undefined || val === null || val === '') {
        return NextResponse.json(
          { error: `"${field.label}" is required` },
          { status: 400 },
        )
      }
    }
  }

  try {
    await createFormSubmission(form.id, {
      submitterName:  parsed.data.submitterName,
      submitterEmail: parsed.data.submitterEmail,
      answers:        parsed.data.answers as Record<string, unknown>,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}
