// src/retrieval/vectorSearch.js
// Semantic search + metadata filter สำหรับดึง Rulebook chunks

const logger = require('pino')();

// ─── Vector DB Client (กำหนดตาม provider) ──────────────────────────
// TODO: swap implementation ตาม VECTOR_DB_PROVIDER ใน .env
// ตอนนี้เป็น interface stub รอ implementation จริง

/**
 * ดึง Rulebook chunks ที่ตรงกับ query message
 * พร้อม metadata filter ตาม spec
 * 
 * @param {string} query - ข้อความแชทจากลูกค้า
 * @param {object} opts - { scope, accessLevel, topK }
 * @returns {{ chunks: Array, vectorSimilarity: number }}
 */
async function retrieveRulebookChunks(query, opts = {}) {
  const {
    scope = 'general',  // ได้จาก JWT.team (passed in from upstream)
    accessLevel = 'agent',
    topK = 5
  } = opts;

  try {
    const provider = process.env.VECTOR_DB_PROVIDER || 'pgvector';

    // ─── Mandatory Filters (ตาม Retrieval Rules §5.1) ───────────────
    const mandatoryFilters = {
      active_status: true,
      // effective_date: MAX — handled in query logic ด้านล่าง
    };

    // ─── Scope Priority (ตาม Retrieval Rules §5.2) ──────────────────
    // partner team: ดู partner docs ก่อน fallback general
    // general team: ดู general เท่านั้น
    const scopeFilter = scope === 'partner'
      ? ['partner', 'general']
      : ['general'];

    logger.debug({ query: query.slice(0, 50), scope, topK }, 'Retrieving Rulebook chunks');

    // ─── Execute Search (ตาม provider) ──────────────────────────────
    let result;
    switch (provider) {
      case 'pgvector':
        result = await searchPgVector(query, { mandatoryFilters, scopeFilter, accessLevel, topK });
        break;
      case 'chroma':
        result = await searchChroma(query, { mandatoryFilters, scopeFilter, accessLevel, topK });
        break;
      case 'pinecone':
        result = await searchPinecone(query, { mandatoryFilters, scopeFilter, accessLevel, topK });
        break;
      default:
        throw new Error(`Unsupported VECTOR_DB_PROVIDER: ${provider}`);
    }

    return result;

  } catch (err) {
    logger.error({ err }, 'Vector search failed');
    return { chunks: [], vectorSimilarity: 0 };
  }
}

// ─── pgvector Implementation ─────────────────────────────────────────
async function searchPgVector(query, { mandatoryFilters, scopeFilter, accessLevel, topK }) {
  // TODO: implement pgvector search
  // 1. สร้าง embedding สำหรับ query
  // 2. cosine similarity search ใน table rulebook_chunks
  // 3. filter ตาม mandatory + scope + access_level + MAX(effective_date)
  
  // Stub: return empty ระหว่างรอ implementation
  logger.warn('pgvector search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

// ─── Chroma Implementation ────────────────────────────────────────────
async function searchChroma(query, opts) {
  // TODO: implement Chroma search
  logger.warn('Chroma search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

// ─── Pinecone Implementation ──────────────────────────────────────────
async function searchPinecone(query, opts) {
  // TODO: implement Pinecone search
  logger.warn('Pinecone search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

/**
 * Chunk Metadata ที่ต้องมีทุก chunk (ตาม spec §5.3)
 * @typedef {object} RulebookChunk
 * @property {string} document_id
 * @property {string} version
 * @property {string} section_id
 * @property {string} effective_date
 * @property {boolean} active_status
 * @property {string} scope         - 'general' | 'partner'
 * @property {string} access_level  - 'agent' | 'supervisor' | 'admin'
 * @property {string} content       - เนื้อหา chunk
 */

module.exports = { retrieveRulebookChunks };
