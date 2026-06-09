// src/routes/webhook.js
const express = require('express');
const crypto = require('crypto');
const { processMessage } = require('../ai/claudeClient');
const logger = require('pino')();

const router = express.Router();

function verifyLineSignature(rawBody, signature) {
  if (process.env.MOCK_MODE === 'true') return true;

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) throw new Error('LINE_CHANNEL_SECRET not set');

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
    .digest('base64');

  return hash === signature;
}

router.post('/', (req, res) => {
  const signature = req.headers['x-line-signature'];

  if (!signature || !verifyLineSignature(req.body, signature)) {
    logger.warn('Invalid LINE signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    logger.warn('Failed to parse webhook body');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  res.status(200).send('OK');

  if (body.events && body.events.length > 0) {
    for (const event of body.events) {
      processEvent(event).catch(err => {
        logger.error({ err, event }, 'Failed to process event');
      });
    }
  }
});

async function processEvent(event) {
  logger.info({ eventType: event.type, source: event.source }, 'Processing event');

  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        await processMessage(event);
      }
      break;
    case 'follow':
      logger.info({ userId: event.source.userId }, 'New follower');
      break;
    case 'unfollow':
      logger.info({ userId: event.source.userId }, 'Unfollowed');
      break;
    case 'postback':
      logger.info({ data: event.postback.data }, 'Postback received');
      break;
    default:
      logger.debug({ eventType: event.type }, 'Unhandled event type');
  }
}

module.exports = router;
