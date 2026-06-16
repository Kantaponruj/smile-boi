// src/store/logStore.js
const { dbQuery } = require('../db/client');

let memStore = [];

function useDb() {
  return process.env.MOCK_MODE !== 'false' ? false : !!process.env.DATABASE_URL;
}

async function appendLog(entry) {
  if (useDb()) {
    await dbQuery(
      `INSERT INTO tagging_logs
         (case_id, tag, level, score, action, description, message, missing_information, review_owner, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.case_id,
        entry.tag ?? null,
        entry.level ?? null,
        entry.score ?? null,
        entry.action ?? null,
        entry.description ?? null,
        entry.message ?? null,
        entry.missing_information ?? null,
        entry.review_owner ?? null,
        entry.timestamp ?? new Date().toISOString(),
      ]
    );
    return;
  }
  memStore.unshift(entry);
  if (memStore.length > 200) memStore = memStore.slice(0, 200);
}

async function getLogs(limit = 100) {
  if (useDb()) {
    return dbQuery(
      'SELECT * FROM tagging_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
  }
  return memStore.slice(0, limit);
}

async function clearLogs() {
  if (useDb()) {
    await dbQuery('DELETE FROM tagging_logs', []);
    return;
  }
  memStore = [];
}

module.exports = { appendLog, getLogs, clearLogs };
