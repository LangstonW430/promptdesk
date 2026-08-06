import { describe, it, expect } from 'vitest'
import { foldCategoryTail, OTHER_CATEGORY } from '../calc'
import type { CategoryStat } from '../types'

function stat(category: string, total: number, count = 1): CategoryStat {
  return { category, total, count }
}

// groupByCategory returns descending-by-total, which is what this assumes.
const SEVEN = [
  stat('Software', 700),
  stat('Travel', 600),
  stat('Meals', 500),
  stat('Hardware', 400),
  stat('Ads', 300),
  stat('Legal', 200),
  stat('Books', 100),
]

describe('foldCategoryTail', () => {
  it('leaves a list already within the limit untouched', () => {
    expect(foldCategoryTail(SEVEN, 7)).toEqual(SEVEN)
  })

  it('does not mutate the input', () => {
    const input = [...SEVEN, stat('Extra', 50)]
    const snapshot = JSON.parse(JSON.stringify(input))
    foldCategoryTail(input, 7)
    expect(input).toEqual(snapshot)
  })

  it('folds everything past the limit into one bucket', () => {
    const result = foldCategoryTail([...SEVEN, stat('Extra', 50), stat('Misc', 25)], 7)

    expect(result).toHaveLength(8)
    expect(result.slice(0, 7)).toEqual(SEVEN)
    expect(result[7]).toEqual({ category: OTHER_CATEGORY, total: 75, count: 2 })
  })

  it('keeps the folded total equal to the input total', () => {
    const input = [...SEVEN, stat('Extra', 50), stat('Misc', 25)]
    const sum = (rows: CategoryStat[]) => rows.reduce((s, r) => s + r.total, 0)

    // The bucket has to carry the full remainder — a chart whose slices sum to
    // less than its own total is worse than one with repeated colours.
    expect(sum(foldCategoryTail(input, 7))).toBe(sum(input))
  })

  it('merges a pre-existing "Other" category into the bucket', () => {
    // Otherwise the chart renders two rows both labelled "Other".
    const result = foldCategoryTail(
      [stat('Software', 700), stat(OTHER_CATEGORY, 90, 3), stat('Travel', 600)],
      2,
    )

    expect(result.filter((r) => r.category === OTHER_CATEGORY)).toHaveLength(1)
    expect(result).toEqual([
      stat('Software', 700),
      stat('Travel', 600),
      { category: OTHER_CATEGORY, total: 90, count: 3 },
    ])
  })

  it('emits no bucket when nothing was folded', () => {
    const result = foldCategoryTail(SEVEN.slice(0, 3), 7)
    expect(result.some((r) => r.category === OTHER_CATEGORY)).toBe(false)
  })

  it('handles an empty list', () => {
    expect(foldCategoryTail([], 7)).toEqual([])
  })

  it('returns nothing for a non-positive limit rather than looping', () => {
    expect(foldCategoryTail(SEVEN, 0)).toEqual([])
  })
})
