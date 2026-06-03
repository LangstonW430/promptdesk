import { describe, it, expect } from 'vitest'
import { renderTemplate, estimateTokens } from '../renderer'
import { BUILT_IN_TEMPLATES } from '../templates'
import type { BuiltInTemplate, RenderContext } from '../template-types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUB: Pick<BuiltInTemplate, 'key' | 'version' | 'body'> = {
  key: 'test_template',
  version: 1,
  body: 'Hello {{business_name}}. Today is {{today}}. Objective: {{objective}}.\n\n{{context_block}}',
}

const CTX: RenderContext = {
  businessName: 'Acme Freelance',
  businessType: 'web development',
  today: 'Jun 3, 2026',
  objective: 'grow revenue',
  contextBlock: '--- CLIENT: Acme Corp ---\nValue: $5,000\nStatus: negotiating',
}

// ─── Substitution ─────────────────────────────────────────────────────────────

describe('renderTemplate — substitution', () => {
  it('replaces all known placeholders', () => {
    const { text } = renderTemplate(STUB, CTX)
    expect(text).toContain('Acme Freelance')
    expect(text).toContain('Jun 3, 2026')
    expect(text).toContain('grow revenue')
    expect(text).toContain('Acme Corp')
  })

  it('leaves no unreplaced {{placeholders}} in the output', () => {
    const { text } = renderTemplate(STUB, CTX)
    expect(text).not.toMatch(/\{\{[^}]+\}\}/)
  })

  it('replaces multiple occurrences of the same placeholder', () => {
    const tmpl = { ...STUB, body: '{{business_name}} and {{business_name}}' }
    expect(renderTemplate(tmpl, CTX).text).toBe('Acme Freelance and Acme Freelance')
  })

  it('replaces business_type when present in template', () => {
    const tmpl = { ...STUB, body: 'Type: {{business_type}}' }
    expect(renderTemplate(tmpl, CTX).text).toBe('Type: web development')
  })
})

// ─── Missing placeholders ─────────────────────────────────────────────────────

describe('renderTemplate — missing placeholders', () => {
  it('replaces unknown placeholder with empty string', () => {
    const tmpl = { ...STUB, body: 'Hello {{unknown_key}}.' }
    expect(renderTemplate(tmpl, CTX).text).toBe('Hello .')
  })

  it('records unknown placeholder in missingPlaceholders', () => {
    const tmpl = { ...STUB, body: '{{missing_one}} and {{missing_two}}' }
    const { missingPlaceholders } = renderTemplate(tmpl, CTX)
    expect(missingPlaceholders).toEqual(
      expect.arrayContaining(['missing_one', 'missing_two']),
    )
  })

  it('does not report known placeholders as missing', () => {
    expect(renderTemplate(STUB, CTX).missingPlaceholders).toHaveLength(0)
  })

  it('does not crash when all placeholders are missing', () => {
    const tmpl = { ...STUB, body: '{{a}} {{b}} {{c}}' }
    expect(() => renderTemplate(tmpl, CTX)).not.toThrow()
  })
})

// ─── Used placeholders ────────────────────────────────────────────────────────

describe('renderTemplate — usedPlaceholders', () => {
  it('reports all resolved placeholder keys', () => {
    const { usedPlaceholders } = renderTemplate(STUB, CTX)
    expect(usedPlaceholders).toEqual(
      expect.arrayContaining(['business_name', 'today', 'objective', 'context_block']),
    )
  })

  it('deduplicates keys that appear more than once in the template', () => {
    const tmpl = { ...STUB, body: '{{business_name}} {{business_name}}' }
    const { usedPlaceholders } = renderTemplate(tmpl, CTX)
    expect(usedPlaceholders.filter((k) => k === 'business_name')).toHaveLength(1)
  })

  it('does not include missing keys in usedPlaceholders', () => {
    const tmpl = { ...STUB, body: '{{business_name}} {{missing}}' }
    const { usedPlaceholders } = renderTemplate(tmpl, CTX)
    expect(usedPlaceholders).not.toContain('missing')
  })
})

// ─── Extras ───────────────────────────────────────────────────────────────────

describe('renderTemplate — extras', () => {
  it('resolves a custom extra placeholder', () => {
    const tmpl = { ...STUB, body: 'Client: {{client_name}}' }
    const result = renderTemplate(tmpl, { ...CTX, extras: { client_name: 'GlobalTech' } })
    expect(result.text).toBe('Client: GlobalTech')
    expect(result.usedPlaceholders).toContain('client_name')
  })

  it('extra keys do not appear in missingPlaceholders', () => {
    const tmpl = { ...STUB, body: '{{custom_field}}' }
    const result = renderTemplate(tmpl, { ...CTX, extras: { custom_field: 'hello' } })
    expect(result.missingPlaceholders).not.toContain('custom_field')
  })
})

// ─── Optional context fields ──────────────────────────────────────────────────

describe('renderTemplate — optional RenderContext fields', () => {
  it('handles missing businessName with empty string', () => {
    const { text } = renderTemplate(STUB, { ...CTX, businessName: undefined })
    expect(text).not.toMatch(/\{\{business_name\}\}/)
    expect(text).toContain('Hello .')
  })

  it('handles missing objective with empty string', () => {
    const { text } = renderTemplate(STUB, { ...CTX, objective: undefined })
    expect(text).not.toMatch(/\{\{objective\}\}/)
  })
})

// ─── Token count ──────────────────────────────────────────────────────────────

describe('renderTemplate — tokenCount', () => {
  it('returns a positive tokenCount', () => {
    expect(renderTemplate(STUB, CTX).tokenCount).toBeGreaterThan(0)
  })

  it('equals Math.ceil(text.length / 4)', () => {
    const { text, tokenCount } = renderTemplate(STUB, CTX)
    expect(tokenCount).toBe(Math.ceil(text.length / 4))
  })
})

describe('estimateTokens', () => {
  it('returns ceil(length/4)', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })
})

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe('renderTemplate — metadata', () => {
  it('returns the correct templateKey', () => {
    expect(renderTemplate(STUB, CTX).templateKey).toBe('test_template')
  })

  it('returns the correct templateVersion', () => {
    expect(renderTemplate(STUB, CTX).templateVersion).toBe(1)
  })
})

// ─── BUILT_IN_TEMPLATES — structural integrity ────────────────────────────────

describe('BUILT_IN_TEMPLATES — structure', () => {
  it('exports a non-empty array', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('every template has a unique key', () => {
    const keys = BUILT_IN_TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every template has a non-empty body', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.body.trim().length, `${t.key} body is empty`).toBeGreaterThan(0)
    }
  })

  it('every template body contains {{context_block}}', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.body, `${t.key} missing {{context_block}}`).toContain('{{context_block}}')
    }
  })

  it('every template has a valid scope', () => {
    const valid = new Set(['global', 'client', 'notes'])
    for (const t of BUILT_IN_TEMPLATES) {
      expect(valid.has(t.scope), `${t.key} has invalid scope "${t.scope}"`).toBe(true)
    }
  })

  it('every template has a positive tokenBudget', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.tokenBudget, `${t.key} tokenBudget ≤ 0`).toBeGreaterThan(0)
    }
  })

  it('every template has version ≥ 1', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.version, `${t.key} version < 1`).toBeGreaterThanOrEqual(1)
    }
  })

  it('every template has a non-empty description', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.description.trim().length, `${t.key} description is empty`).toBeGreaterThan(0)
    }
  })
})

describe('BUILT_IN_TEMPLATES — render smoke test', () => {
  const ctx: RenderContext = {
    businessName: 'Test Business',
    businessType: 'consulting',
    today: 'Jun 3, 2026',
    objective: 'grow revenue',
    contextBlock: '--- test context block ---',
  }

  it('renders all templates without throwing', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(() => renderTemplate(t, ctx), `${t.key} threw during render`).not.toThrow()
    }
  })

  it('renders all templates with zero missingPlaceholders given full context', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const { missingPlaceholders } = renderTemplate(t, ctx)
      expect(
        missingPlaceholders,
        `${t.key} has missing placeholders: ${missingPlaceholders.join(', ')}`,
      ).toHaveLength(0)
    }
  })

  it('every rendered template has a positive tokenCount', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const { tokenCount } = renderTemplate(t, ctx)
      expect(tokenCount, `${t.key} tokenCount is 0`).toBeGreaterThan(0)
    }
  })
})

describe('BUILT_IN_TEMPLATES — required keys present', () => {
  const required = [
    'business_advisor',
    'business_action_plan',
    'weekly_planning',
    'revenue_analysis',
    'client_review',
    'client_insight',
    'proposal_strategy',
    'follow_up_recommendations',
    'meeting_analysis',
    'note_analysis',
    'lead_qualification',
  ]

  for (const key of required) {
    it(`includes "${key}"`, () => {
      expect(
        BUILT_IN_TEMPLATES.find((t) => t.key === key),
        `missing template "${key}"`,
      ).toBeDefined()
    })
  }
})
