// src/app.js
// smileChatBot — Main Application Entry Point

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { pino } = require('pino');
const pinoHttp = require('pino-http');

const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');

// ─── Logger ─────────────────────────────────────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});

// ─── App Setup ──────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// CORS (restrict ใน production)
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : '*'
}));

// HTTP request logging
app.use(pinoHttp({ logger }));

// ⚠️ LINE SDK ต้องการ raw body สำหรับ signature verification
// ต้องใช้ express.raw ก่อน express.json สำหรับ /webhook
app.use('/webhook', express.raw({ type: 'application/json' }));

// JSON parser สำหรับ routes อื่น
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`smileChatBot listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; // สำหรับ testing
