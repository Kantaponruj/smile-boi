// src/retrieval/vectorSearch.js
const logger = require('pino')();
const { dbQuery } = require('../db/client');

// Priority order matters — more specific intents checked first
const INTENT_KEYWORDS = {
  payment_confirmation: ['โอนแล้ว', 'ชำระแล้ว', 'จ่ายแล้ว', 'โอนเงินแล้ว', 'สลิป', 'แจ้งโอน', 'ส่งสลิป', 'แนบสลิป'],
  order_confirmation:   ['สั่งซื้อเลย', 'สั่งได้เลย', 'ขอสั่ง', 'ยืนยันออเดอร์', 'ยืนยันการสั่ง', 'จะสั่ง', 'สั่งเลย', 'order'],
  quotation:            ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ', 'คิดราคา', 'ราคาส่ง', 'ราคาต่อหน่วย'],
  complaint:            ['ไม่พอใจ', 'ร้องเรียน', 'เสียหาย', 'ไม่ตรง', 'ปัญหา', 'แย่', 'ไม่ดี', 'ผิดพลาด'],
  payment:              ['ชำระ', 'โอนเงิน', 'จ่ายเงิน', 'payment', 'บัตรเครดิต', 'พร้อมเพย์', 'ชำระเงิน', 'วิธีจ่าย'],
  delivery_inquiry:     ['จัดส่ง', 'ส่งของ', 'พัสดุ', 'tracking', 'ติดตามพัสดุ', 'เลขพัสดุ', 'delivery', 'ส่งเมื่อไหร่', 'ได้รับของยัง'],
  promotion_inquiry:    ['โปร', 'โปรโมชั่น', 'ส่วนลด', 'ลดราคา', 'discount', 'sale', 'แคมเปญ', 'ของแถม', 'สิทธิพิเศษ'],
  purchase_intent:      ['สนใจ', 'กำลังพิจารณา', 'พิจารณา', 'น่าสนใจ', 'คิดจะ', 'อยากได้', 'กำลังคิด'],
  product_inquiry:      ['สอบถาม', 'ข้อมูลสินค้า', 'สเปค', 'รายละเอียด', 'คุณสมบัติ', 'มีสินค้า', 'ประกัน', 'spec'],
  follow_up:            ['ติดตาม', 'ตามเรื่อง', 'ได้รับยัง', 'ความคืบหน้า', 'อัปเดต', 'update', 'เป็นยังไงบ้าง'],
}

const INTENT_SCORE = {
  payment_confirmation: 0.93,
  order_confirmation:   0.92,
  quotation:            0.91,
  complaint:            0.85,
  payment:              0.88,
  delivery_inquiry:     0.82,
  promotion_inquiry:    0.75,
  purchase_intent:      0.67,
  product_inquiry:      0.65,
  follow_up:            0.67,
  general:              0.28,
}

const MOCK_CHUNKS = [
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '1.0',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#General_Inquiry — ข้อความทั่วไปที่ไม่สามารถระบุเจตนาได้ เช่น "สวัสดี", "ขอถามหน่อย", "มีอะไรแนะนำไหม"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '2.1',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Product_Inquiry — ลูกค้าสอบถามข้อมูลหรือรายละเอียดสินค้า เช่น "ขอสเปคสินค้าหน่อย", "มีประกันไหม", "สินค้ามีกี่แบบ"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '2.2',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Promotion_Inquiry — ลูกค้าสอบถามโปรโมชั่นหรือส่วนลด เช่น "มีโปรไหมครับ", "ลดราคาได้ไหม", "มีของแถมไหม"',
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
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '3.2',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Order_Confirmation — ลูกค้ายืนยันการสั่งซื้อ เช่น "สั่งเลยครับ", "ขอสั่ง 10 ชิ้น", "ยืนยันออเดอร์นี้ได้เลย"',
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
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '4.4',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Delivery_Inquiry — ลูกค้าสอบถามสถานะการจัดส่ง เช่น "ของส่งเมื่อไหร่", "เลขพัสดุคืออะไร", "ได้รับของยังครับ"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '5.1',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Payment_Inquiry — ลูกค้าสอบถามการชำระเงิน เช่น "โอนได้เลยไหม", "รับบัตรเครดิตไหม", "พร้อมเพย์ได้ไหม"',
  },
  {
    document_id: 'corporate-tagging-rulebook', version: 'v3.0', section_id: '5.2',
    effective_date: '2026-01-01', active_status: true, scope: 'general', access_level: 'agent',
    content: '#Payment_Confirmation — ลูกค้าแจ้งชำระเงินแล้ว เช่น "โอนแล้วนะครับ", "ส่งสลิปให้", "ชำระเงินเรียบร้อย"',
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
