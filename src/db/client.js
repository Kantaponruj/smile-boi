// src/db/client.js
const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!_sql) _sql = neon(url);
  return _sql;
}

function dbQuery(text, params) {
  return getSql()(text, params);
}

module.exports = { dbQuery };
