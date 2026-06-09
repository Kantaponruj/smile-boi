import path from 'path'

export const runtime = 'nodejs'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // In MOCK_MODE skip signature verification (default for demo)
  const isMock = process.env.MOCK_MODE !== 'false'

  if (!isMock) {
    const signature = request.headers.get('x-line-signature')
    if (!signature) {
      return Response.json({ error: 'Missing x-line-signature' }, { status: 401 })
    }
  }

  const { processMessage } = require(path.resolve('src/ai/claudeClient'))
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
