// src/retrieval/vectorSearch.js
const logger = require('pino')();
const { dbQuery } = require('../db/client');

const HIGH_KEYWORDS   = ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ'];
const MEDIUM_KEYWORDS = ['สนใจ', 'กำลังพิจารณา', 'พิจารณา', 'กำลังคิด', 'น่าสนใจ', 'คิดจะ'];

const MOCK_CHUNKS = [
  {
    document_id: 'corporate-tagging-rulebook',
    version: 'v3.0',
    section_id: '2.3',
    effective_date: '2026-01-01',
    active_status: true,
    scope: 'general',
    access_level: 'agent',
    content: '#Quotation_Request — ลูกค้าส่งข้อความขอราคาหรือใบเสนอราคา เช่น "ขอใบเสนอราคา", "ราคาเท่าไหร่", "สั่งซื้อจำนวนมากได้ไหม"'
  },
  {
    document_id: 'corporate-tagging-rulebook',
    version: 'v3.0',
    section_id: '3.1',
    effective_date: '2026-01-01',
    active_status: true,
    scope: 'general',
    access_level: 'agent',
    content: '#Purchase_Intent — ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน เช่น "กำลังพิจารณา", "สนใจอยู่", "น่าสนใจดี"'
  }
];

function detectMockSimilarity(query) {
  const q = query.toLowerCase();
  if (HIGH_KEYWORDS.some(kw => q.includes(kw)))   return 0.91;
  if (MEDIUM_KEYWORDS.some(kw => q.includes(kw))) return 0.67;
  return 0.28;
}

async function retrieveRulebookChunks(query) {
  const isMock = process.env.MOCK_MODE !== 'false';

  if (isMock) {
    const vectorSimilarity = detectMockSimilarity(query);
    logger.debug({ query: query.slice(0, 50), vectorSimilarity }, 'Vector search (mock)');
    return { chunks: MOCK_CHUNKS, vectorSimilarity };
  }

  const rows = await dbQuery(
    `SELECT id, document_id, version, section_id, effective_date,
            active_status, scope, access_level, content
     FROM rulebook_chunks
     WHERE active_status = $1
     ORDER BY effective_date DESC`,
    [true]
  );

  const vectorSimilarity = detectMockSimilarity(query);
  logger.debug({ query: query.slice(0, 50), vectorSimilarity, rowCount: rows.length }, 'Vector search (db)');

  return { chunks: rows, vectorSimilarity };
}

module.exports = { retrieveRulebookChunks, detectMockSimilarity };
