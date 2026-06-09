import { processMessage } from '../../../src/ai/claudeClient'

export const runtime = 'nodejs'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const isMock = process.env.MOCK_MODE !== 'false'

  if (!isMock) {
    const signature = request.headers.get('x-line-signature')
    if (!signature) {
      return Response.json({ error: 'Missing x-line-signature' }, { status: 401 })
    }
  }

  const results = []

  if (Array.isArray(body.events)) {
    for (const event of body.events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        try {
          const result = await processMessage(event)
          results.push(result)
        } catch (err) {
          console.error('[webhook] processMessage error:', err)
        }
      }
    }
  }

  return Response.json({ ok: true, results })
}
