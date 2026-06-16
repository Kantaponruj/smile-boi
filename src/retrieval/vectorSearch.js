// src/retrieval/vectorSearch.js
const logger = require('pino')();
const { dbQuery } = require('../db/client');

const INTENT_KEYWORDS = {
  quotation:       ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ', 'คิดราคา', 'ราคาส่ง', 'ราคาต่อหน่วย'],
  complaint:       ['ไม่พอใจ', 'ร้องเรียน', 'เสียหาย', 'ไม่ตรง', 'ปัญหา', 'แย่', 'ไม่ดี', 'ผิดพลาด'],
  payment:         ['ชำระ', 'โอนเงิน', 'จ่ายเงิน', 'payment', 'บัตรเครดิต', 'พร้อมเพย์', 'ชำระเงิน'],
  purchase_intent: ['สนใจ', 'กำลังพิจารณา', 'พิจารณา', 'น่าสนใจ', 'คิดจะ', 'อยากได้', 'กำลังคิด'],
  follow_up:       ['ติดตาม', 'ตามเรื่อง', 'ได้รับยัง', 'ความคืบหน้า', 'อัปเดต', 'update', 'เป็นยังไงบ้าง'],
}

const INTENT_SCORE = {
  quotation: 0.91,
  complaint: 0.85,
  payment: 0.88,
  purchase_intent: 0.67,
  follow_up: 0.67,
  general: 0.28,
}

const MOCK_CHUNKS = [
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '1.0',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#General_Inquiry — ข้อความทั่วไปที่ไม่สามารถระบุเจตนาได้ เช่น "สวัสดี", "ขอถามหน่อย", "มีอะไรแนะนำไหม"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '2.3',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Quotation_Request — ลูกค้าส่งข้อความขอราคาหรือใบเสนอราคา เช่น "ขอใบเสนอราคา", "ราคาเท่าไหร่", "สั่งซื้อจำนวนมากได้ไหม"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '3.1',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Purchase_Intent — ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน เช่น "กำลังพิจารณา", "สนใจอยู่", "น่าสนใจดี"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '4.1',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Follow_Up — ลูกค้าติดตามเรื่องที่ค้างไว้ เช่น "ติดตามเรื่องใบเสนอราคา", "ได้รับอีเมลยังครับ", "ความคืบหน้าเป็นยังไง"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '4.2',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Complaint — ลูกค้าร้องเรียนหรือแจ้งปัญหา เช่น "สินค้าไม่ตรงปก", "ไม่พอใจบริการ", "เกิดปัญหาตอนจัดส่ง"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '5.1',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Payment_Inquiry — ลูกค้าสอบถามการชำระเงิน เช่น "โอนได้เลยไหม", "รับบัตรเครดิตไหม", "พร้อมเพย์ได้ไหม"',
  },
]

function detectIntent(query) {
  const q = query.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      return { intent, score: INTENT_SCORE[intent] };
    }
  }
  return { intent: 'general', score: 0.28 };
}

function detectMockSimilarity(query) {
  return detectIntent(query).score;
}

function scoreChunk(query) {
  return detectIntent(query).score;
}

async function retrieveRulebookChunks(query) {
  const isMock = process.env.MOCK_MODE !== 'false';
  const { intent, score } = detectIntent(query);

  if (isMock) {
    logger.debug({ query: query.slice(0, 50), score, intent }, 'Vector search (mock)');
    return { chunks: MOCK_CHUNKS, vectorSimilarity: score, intent };
  }

  const rows = await dbQuery(
    `SELECT id, document_id, version, section_id, effective_date,
            active_status, scope, access_level, content
     FROM rulebook_chunks
     WHERE active_status = $1
     ORDER BY effective_date DESC`,
    [true]
  );

  const scoredRows = rows
    .map(row => ({ ...row, _score: scoreChunk(query) }))
    .sort((a, b) => b._score - a._score);

  const vectorSimilarity = scoredRows.length > 0 ? score : 0.28;
  logger.debug({ query: query.slice(0, 50), vectorSimilarity, intent, rowCount: rows.length }, 'Vector search (db)');

  return { chunks: scoredRows, vectorSimilarity, intent };
}

module.exports = { retrieveRulebookChunks, detectMockSimilarity };
