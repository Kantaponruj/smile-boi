// src/db/client.js
const { neon } = require('@neondatabase/serverless');

function dbQuery(text, params) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  return sql(text, params);
}

module.exports = { dbQuery };
