import { prisma } from './client'

/**
 * Foreign keys arriving from a request body.
 *
 * `ownerId` is derived from the session and never trusted from the client — but
 * a `clientId` or `projectId` in the body is exactly as untrusted, and pointing
 * one at another user's row attaches their data to a record you own. The
 * invoice list and the public invoice page both render the joined client's
 * name, so an unchecked `clientId` was a way to read it.
 *
 * Every create that accepts a relation id runs these first. `createProject`,
 * `createTask`, `createNote` and `createTimeEntry` already did their own
 * equivalent check inline; these exist so the ones that did not can stop
 * re-deriving the rule.
 */

/** Whether this client belongs to this owner. */
export async function ownsClient(
  ownerId: string,
  clientId: string,
): Promise<boolean> {
  const count = await prisma.client.count({ where: { id: clientId, ownerId } })
  return count > 0
}

/**
 * Whether this project belongs to this owner — and, when `clientId` is given,
 * to that client too.
 *
 * The second half matters as much as the first: attaching your own client's
 * money to a different client's project is not a permission failure, but it
 * does put the wrong number in a project's P&L.
 */
export async function ownsProject(
  ownerId: string,
  projectId: string,
  clientId?: string | null,
): Promise<boolean> {
  const count = await prisma.project.count({
    where: { id: projectId, ownerId, ...(clientId ? { clientId } : {}) },
  })
  return count > 0
}
