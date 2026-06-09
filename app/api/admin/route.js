import { getLogs, clearLogs } from '../../../src/store/logStore'

export const runtime = 'nodejs'

export async function GET() {
  const logs = await getLogs(100)
  return Response.json({ logs, total: logs.length })
}

export async function DELETE() {
  await clearLogs()
  return Response.json({ ok: true })
}
