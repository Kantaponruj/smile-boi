// src/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mock: process.env.MOCK_MODE === 'true' });
});

module.exports = router;
