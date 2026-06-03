import { NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { getDashboardAggregates } from '@/lib/dashboard'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function serverError(err: unknown) {
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const aggregates = await getDashboardAggregates(ownerId)
    return NextResponse.json(aggregates)
  } catch (err) {
    return serverError(err)
  }
}
