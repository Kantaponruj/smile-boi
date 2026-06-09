// src/retrieval/vectorSearch.js
const logger = require('pino')();

const MOCK_MODE = process.env.MOCK_MODE === 'true';

const HIGH_KEYWORDS  = ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ'];
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

async function retrieveRulebookChunks(query, opts = {}) {
  if (MOCK_MODE) {
    const vectorSimilarity = detectMockSimilarity(query);
    logger.debug({ query: query.slice(0, 50), vectorSimilarity }, '[MOCK] Vector search');
    return { chunks: MOCK_CHUNKS, vectorSimilarity };
  }

  const { scope = 'general', accessLevel = 'agent', topK = 5 } = opts;
  const provider = process.env.VECTOR_DB_PROVIDER || 'pgvector';

  try {
    switch (provider) {
      case 'pgvector':
        return await searchPgVector(query, { scope, accessLevel, topK });
      case 'chroma':
        return await searchChroma(query, { scope, accessLevel, topK });
      case 'pinecone':
        return await searchPinecone(query, { scope, accessLevel, topK });
      default:
        throw new Error(`Unsupported VECTOR_DB_PROVIDER: ${provider}`);
    }
  } catch (err) {
    logger.error({ err }, 'Vector search failed');
    return { chunks: [], vectorSimilarity: 0 };
  }
}

async function searchPgVector(query, opts) {
  logger.warn('pgvector search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

async function searchChroma(query, opts) {
  logger.warn('Chroma search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

async function searchPinecone(query, opts) {
  logger.warn('Pinecone search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

module.exports = { retrieveRulebookChunks, detectMockSimilarity };
