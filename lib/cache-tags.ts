/**
 * Cache tags for `unstable_cache` entries.
 *
 * `revalidatePath()` re-renders a route but does NOT evict `unstable_cache`
 * entries — those are a separate cache keyed independently of the route. The
 * cached finance and dashboard aggregates therefore kept serving stale numbers
 * for up to their `revalidate` window after a mutation, while the uncached
 * parts of the same page updated immediately. Server actions now call
 * `revalidateTag` with these alongside their existing `revalidatePath` calls.
 *
 * Tags are per-owner so one user's mutation never evicts another's cache.
 */

export const financeTag = (ownerId: string) => `finance:${ownerId}`
export const dashboardTag = (ownerId: string) => `dashboard:${ownerId}`
