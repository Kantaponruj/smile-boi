import crypto from 'crypto'
import { processMessage } from '../../../src/ai/claudeClient'
import { appendLog } from '../../../src/store/logStore'

export const runtime = 'nodejs'

function verifyLineSignature(rawBody, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))
}

export async function POST(request) {
  const rawBody = await request.text()

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (process.env.VERIFY_LINE_SIGNATURE === 'true') {
    const signature = request.headers.get('x-line-signature')
    const secret = process.env.LINE_CHANNEL_SECRET
    if (!signature || !secret) {
      return Response.json({ error: 'Missing x-line-signature or LINE_CHANNEL_SECRET' }, { status: 401 })
    }
    try {
      if (!verifyLineSignature(rawBody, signature, secret)) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } catch {
      return Response.json({ error: 'Signature verification failed' }, { status: 401 })
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
