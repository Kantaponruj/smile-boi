export const runtime = 'nodejs'

export async function GET() {
  const isMock = process.env.MOCK_MODE !== 'false'
  let db = 'skipped'

  if (!isMock && process.env.DATABASE_URL) {
    try {
      const { dbQuery } = await import('../../../src/db/client')
      await dbQuery('SELECT 1', [])
      db = 'ok'
    } catch {
      db = 'error'
    }
  }

  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mock: isMock,
    db,
  })
}
