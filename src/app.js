// src/app.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { pino } = require('pino');
const pinoHttp = require('pino-http');

const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : '*'
}));
app.use(pinoHttp({ logger }));

// LINE SDK requires raw body for signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use(express.static(require('path').join(__dirname, '../public')));

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);

if (process.env.MOCK_MODE === 'true') {
  global.__mockLogs = [];

  app.get('/mock/results', (req, res) => {
    res.json({ logs: global.__mockLogs || [] });
  });

  app.post('/mock/reset', (req, res) => {
    global.__mockLogs = [];
    res.json({ ok: true, message: 'Mock logs cleared' });
  });

  logger.info('MOCK_MODE enabled: /mock/results and /mock/reset available');
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Listen only when run directly (not as Vercel serverless function)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`smileChatBot listening on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
