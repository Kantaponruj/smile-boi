// src/routes/webhook.js
// LINE Webhook endpoint — ตอบ 200 ทันที แล้ว process async

const express = require('express');
const crypto = require('crypto');
const { processMessage } = require('../ai/claudeClient');
const logger = require('pino')();

const router = express.Router();

// ─── Signature Verification ─────────────────────────────────────────
function verifyLineSignature(rawBody, signature) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) throw new Error('LINE_CHANNEL_SECRET not set');

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
    .digest('base64');

  return hash === signature;
}

// ─── POST /webhook ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  const signature = req.headers['x-line-signature'];

  // ✅ Verify signature ก่อนทุกกรณี
  if (!signature || !verifyLineSignature(req.body, signature)) {
    logger.warn('Invalid LINE signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse body (ได้ raw buffer จาก express.raw)
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    logger.warn('Failed to parse webhook body');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // ✅ ตอบ LINE ทันที — ต้องภายใน 3 วินาที
  res.status(200).send('OK');

  // ✅ Process async — ไม่บล็อก response
  if (body.events && body.events.length > 0) {
    for (const event of body.events) {
      processEvent(event).catch((err) => {
        logger.error({ err, event }, 'Failed to process event');
      });
    }
  }
});

// ─── Event Router ────────────────────────────────────────────────────
async function processEvent(event) {
  logger.info({ eventType: event.type, source: event.source }, 'Processing event');

  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        await processMessage(event);
      }
      break;

    case 'follow':
      // TODO: ส่ง welcome message
      logger.info({ userId: event.source.userId }, 'New follower');
      break;

    case 'unfollow':
      logger.info({ userId: event.source.userId }, 'Unfollowed');
      break;

    case 'postback':
      // TODO: handle postback actions (เช่น clarification choices)
      logger.info({ data: event.postback.data }, 'Postback received');
      break;

    default:
      logger.debug({ eventType: event.type }, 'Unhandled event type');
  }
}

module.exports = router;
