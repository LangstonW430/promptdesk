/**
 * Seed built-in prompt templates (owner_id = null).
 * Safe to re-run: updates body/name/description if changed, bumps version.
 *
 * Usage:
 *   npx tsx prisma/seed-templates.ts
 *
 * Requires DATABASE_URL in .env.local (loaded via dotenv).
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'
import { BUILT_IN_TEMPLATES } from '../lib/prompt-engine/templates'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function seedTemplates() {
  console.log(`Seeding ${BUILT_IN_TEMPLATES.length} built-in prompt templates…\n`)

  for (const template of BUILT_IN_TEMPLATES) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { key: template.key, ownerId: null },
    })

    if (existing) {
      const bodyChanged = existing.body !== template.body
      const metaChanged =
        existing.name !== template.name ||
        existing.description !== (template.description ?? null) ||
        existing.scope !== template.scope ||
        existing.tokenBudget !== template.tokenBudget

      if (bodyChanged || metaChanged) {
        await prisma.promptTemplate.update({
          where: { id: existing.id },
          data: {
            name: template.name,
            description: template.description ?? null,
            scope: template.scope,
            tokenBudget: template.tokenBudget,
            body: template.body,
            // Only bump version when the prompt body itself changes.
            version: bodyChanged ? existing.version + 1 : existing.version,
          },
        })
        const tag = bodyChanged
          ? `body updated → v${existing.version + 1}`
          : 'metadata updated'
        console.log(`  ✓ updated   ${template.key} (${tag})`)
      } else {
        console.log(`  – unchanged ${template.key}`)
      }
    } else {
      await prisma.promptTemplate.create({
        data: {
          key: template.key,
          name: template.name,
          description: template.description ?? null,
          scope: template.scope,
          tokenBudget: template.tokenBudget,
          version: template.version,
          body: template.body,
          ownerId: null,
        },
      })
      console.log(`  + created   ${template.key}`)
    }
  }

  console.log('\nDone.')
}

seedTemplates()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
