import type { EngineNote } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tokenise text into a lowercase word set, stripping punctuation. */
function wordSet(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return new Set(words.filter((w) => w.length > 1))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 1 : intersection / union
}

const NEAR_DUP_THRESHOLD = 0.85

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Remove exact and near-duplicate notes from a set.
 *
 * Pass 1 — exact dedup: removes notes sharing the same contentHash.
 * Pass 2 — near-dup: removes notes whose word-set Jaccard similarity ≥ 0.85.
 *
 * When two notes are equivalent the newer one (later occurredAt) is kept.
 * Input order is preserved for the survivors.
 */
export function deduplicateNotes(notes: EngineNote[]): {
  unique: EngineNote[]
  droppedCount: number
} {
  if (notes.length <= 1) return { unique: notes, droppedCount: 0 }

  // Sort newest-first so that when we keep the first survivor in each
  // equivalence class, we naturally keep the newer note.
  const sorted = [...notes].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )

  // Pass 1: exact dedup via contentHash
  const seenHashes = new Set<string>()
  const afterExact: EngineNote[] = []
  for (const note of sorted) {
    if (!seenHashes.has(note.contentHash)) {
      seenHashes.add(note.contentHash)
      afterExact.push(note)
    }
  }

  // Pass 2: near-dup via Jaccard
  const survivors: EngineNote[] = []
  const survivorWordSets: Set<string>[] = []

  for (const note of afterExact) {
    const ws = wordSet(note.body)
    let isDuplicate = false
    for (const existingWs of survivorWordSets) {
      if (jaccardSimilarity(ws, existingWs) >= NEAR_DUP_THRESHOLD) {
        isDuplicate = true
        break
      }
    }
    if (!isDuplicate) {
      survivors.push(note)
      survivorWordSets.push(ws)
    }
  }

  // Restore original chronological order (oldest first) for the survivors.
  const survivorIds = new Set(survivors.map((n) => n.id))
  const unique = notes.filter((n) => survivorIds.has(n.id))

  return { unique, droppedCount: notes.length - unique.length }
}
