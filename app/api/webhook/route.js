import { processMessage } from '../../../src/ai/claudeClient'
import { appendLog } from '../../../src/store/logStore'

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

          await appendLog({
            case_id: `LINE-${event.source?.userId?.slice(-8) || 'unknown'}`,
            tag: result.answer_summary?.tag,
            level: result.confidence_signal?.level,
            score: result.confidence_signal?.weighted_final,
            action: result.recommended_action,
            description: result.answer_summary?.description,
            missing_information: result.missing_information,
            message: event.message.text,
            timestamp: new Date().toISOString(),
          })
        } catch (err) {
          console.error('[webhook] processMessage error:', err)
        }
      }
    }
  }

  return Response.json({ ok: true, results })
}
