// src/ai/claudeClient.js
const { retrieveRulebookChunks } = require('../retrieval/vectorSearch');
const { validateOutput, buildRefusalOutput } = require('../validation/schemaValidator');
const { calculateConfidence, shouldEscalate } = require('../validation/confidenceEngine');
const { logTagging, logRefusal } = require('../models/TaggingLog');
const logger = require('pino')();

const INTENT_RESPONSE = {
  quotation: {
    tag: '#Quotation_Request', section: '2.3', llm_score: 0.90,
    action: 'tag', missing: null, owner: 'admin',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — ระบุเจตนาขอใบเสนอราคาชัดเจน อ้างอิงจาก Rulebook §2.3`,
  },
  complaint: {
    tag: '#Complaint', section: '4.2', llm_score: 0.85,
    action: 'tag_with_flag', missing: null, owner: 'supervisor',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — แจ้งปัญหาหรือความไม่พอใจ ต้องการ Supervisor ตรวจสอบ อ้างอิงจาก Rulebook §4.2`,
  },
  payment: {
    tag: '#Payment_Inquiry', section: '5.1', llm_score: 0.88,
    action: 'tag', missing: null, owner: 'admin',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — สอบถามช่องทางหรือวิธีการชำระเงิน อ้างอิงจาก Rulebook §5.1`,
  },
  purchase_intent: {
    tag: '#Purchase_Intent', section: '3.1', llm_score: 0.68,
    action: 'tag', missing: null, owner: 'admin',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — แสดงความสนใจแต่ยังไม่ยืนยันการซื้อ อ้างอิงจาก Rulebook §3.1`,
  },
  follow_up: {
    tag: '#Follow_Up', section: '4.1', llm_score: 0.72,
    action: 'tag_with_flag', missing: 'ต้องการทราบ Case ID หรือรายละเอียดเรื่องที่ติดตามเพื่อยืนยัน', owner: 'admin',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — ติดตามเรื่องที่ค้างไว้ อ้างอิงจาก Rulebook §4.1`,
  },
  general: {
    tag: '#General_Inquiry', section: '1.0', llm_score: 0.25,
    action: 'refuse', missing: 'ข้อความไม่สอดคล้องกับ Rulebook หมวดใดๆ กรุณาให้ข้อมูลเพิ่มเติมเพื่อระบุเจตนา', owner: 'supervisor',
    descFn: (e) => `ลูกค้าส่งข้อความ "${e}" — ไม่สามารถระบุเจตนาได้ชัดเจนจากข้อมูลที่มี`,
  },
}

function buildMockClaudeResponse(vectorSimilarity, intent, message) {
  // Score-based fallback preserves backward compat with tests that call (score) only
  const resolvedIntent = intent || (
    vectorSimilarity >= 0.8 ? 'quotation' :
    vectorSimilarity >= 0.6 ? 'purchase_intent' :
    'general'
  );

  const r = INTENT_RESPONSE[resolvedIntent] || INTENT_RESPONSE.general;
  const excerpt = message ? (message.length > 35 ? message.slice(0, 35) + '…' : message) : r.tag;

  return {
    answer_summary: { tag: r.tag, description: r.descFn(excerpt) },
    source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: r.section, effective_date: '2026-01-01' },
    confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: r.llm_score, weighted_final: 0, level: 'high' },
    missing_information: r.missing,
    recommended_action: r.action,
    review_owner: r.owner,
  };
}

async function processMessage(event) {
  const chatMessage = event.message.text;
  const userId = event.source.userId;
  const caseId = `LINE-${userId.slice(-8)}`;

  logger.info({ caseId, messageLength: chatMessage.length }, 'Processing message');

  try {
    const { chunks, vectorSimilarity, intent } = await retrieveRulebookChunks(chatMessage);

    if (!chunks || chunks.length === 0) {
      await logRefusal({ case_id: caseId, ai_suggestion: null, refusal_reason: 'no_chunks_found' });
      return buildRefusalOutput('ไม่พบ Rulebook ที่ตรงกับข้อความนี้ในฐานข้อมูล');
    }

    const parsed = buildMockClaudeResponse(vectorSimilarity, intent, chatMessage);
    logger.info({ caseId, vectorSimilarity, intent }, 'Using mock Claude response');

    const confidenceResult = calculateConfidence(vectorSimilarity, parsed.confidence_signal.llm_self_score);
    parsed.confidence_signal = confidenceResult;

    const { valid, errors } = validateOutput(parsed);
    if (!valid) {
      logger.error({ caseId, errors }, 'Schema validation failed');
      return buildRefusalOutput(`Schema validation failed: ${errors?.join(', ')}`);
    }

    if (shouldEscalate(confidenceResult)) {
      parsed.recommended_action = 'refuse';
      parsed.review_owner = 'supervisor';
      await logRefusal({
        case_id: caseId,
        ai_suggestion: parsed.answer_summary?.tag,
        refusal_reason: `confidence_too_low: ${confidenceResult.weighted_final}`,
        confidence_final: confidenceResult.weighted_final
      });
      logger.info({ caseId, confidence: confidenceResult.weighted_final }, 'Refusing — escalating to human');
    } else {
      await logTagging({ case_id: caseId, output: parsed });
      logger.info({ caseId, tag: parsed.answer_summary?.tag, level: confidenceResult.level }, 'Tagged successfully');
    }

    return parsed;

  } catch (err) {
    logger.error({ err, caseId }, 'Unexpected error in processMessage');
    return buildRefusalOutput('เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่หรือติดต่อ Supervisor');
  }
}

module.exports = { processMessage, buildMockClaudeResponse };
