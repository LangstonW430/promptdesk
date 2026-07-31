import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getFormByPublicToken, createFormSubmission } from '@/lib/forms'

// This route is unauthenticated — anyone holding the form's public token can
// POST to it. Bound what a single submission can carry so a caller cannot push
// arbitrarily large blobs into the answers jsonb column.
const MAX_BODY_BYTES = 64 * 1024
const MAX_ANSWER_FIELDS = 100
const MAX_ANSWER_LENGTH = 10_000

const answerValue = z.union([
  z.string().max(MAX_ANSWER_LENGTH),
  z.number(),
  z.boolean(),
  z.null(),
])

const submitSchema = z.object({
  submitterName:  z.string().max(200).optional(),
  submitterEmail: z.string().email().max(300).optional(),
  answers:        z.record(z.string().max(200), answerValue).refine(
    (a) => Object.keys(a).length <= MAX_ANSWER_FIELDS,
    { message: `A submission cannot contain more than ${MAX_ANSWER_FIELDS} answers` },
  ),
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

  // Reject oversized payloads before parsing them into memory.
  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Submission too large' }, { status: 413 })
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Submission too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
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
