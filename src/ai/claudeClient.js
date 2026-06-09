// src/ai/claudeClient.js
const { retrieveRulebookChunks } = require('../retrieval/vectorSearch');
const { validateOutput, buildRefusalOutput } = require('../validation/schemaValidator');
const { calculateConfidence, shouldEscalate } = require('../validation/confidenceEngine');
const { logTagging, logRefusal } = require('../models/TaggingLog');
const logger = require('pino')();

function buildMockClaudeResponse(vectorSimilarity) {
  if (vectorSimilarity >= 0.8) {
    return {
      answer_summary: { tag: '#Quotation_Request', description: 'ลูกค้าต้องการขอใบเสนอราคาสินค้า อ้างอิงจาก Rulebook §2.3' },
      source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '2.3', effective_date: '2026-01-01' },
      confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.90, weighted_final: 0, level: 'high' },
      missing_information: null,
      recommended_action: 'tag',
      review_owner: 'admin'
    };
  }
  if (vectorSimilarity >= 0.6) {
    return {
      answer_summary: { tag: '#Purchase_Intent', description: 'ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน อ้างอิงจาก Rulebook §3.1' },
      source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '3.1', effective_date: '2026-01-01' },
      confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.68, weighted_final: 0, level: 'medium' },
      missing_information: null,
      recommended_action: 'tag',
      review_owner: 'admin'
    };
  }
  return {
    answer_summary: { tag: '#General_Inquiry', description: 'ไม่สามารถระบุเจตนาลูกค้าได้อย่างชัดเจนจากข้อมูลที่มี' },
    source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '1.0', effective_date: '2026-01-01' },
    confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.25, weighted_final: 0, level: 'low' },
    missing_information: 'ข้อความไม่สอดคล้องกับ Rulebook หมวดใดๆ กรุณาให้ข้อมูลเพิ่มเติมเพื่อระบุเจตนา',
    recommended_action: 'refuse',
    review_owner: 'supervisor'
  };
}

async function processMessage(event) {
  const chatMessage = event.message.text;
  const userId = event.source.userId;
  const caseId = `LINE-${userId.slice(-8)}`;

  logger.info({ caseId, messageLength: chatMessage.length }, 'Processing message');

  try {
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks(chatMessage);

    if (!chunks || chunks.length === 0) {
      await logRefusal({ case_id: caseId, ai_suggestion: null, refusal_reason: 'no_chunks_found' });
      return buildRefusalOutput('ไม่พบ Rulebook ที่ตรงกับข้อความนี้ในฐานข้อมูล');
    }

    const parsed = buildMockClaudeResponse(vectorSimilarity);
    logger.info({ caseId, vectorSimilarity }, 'Using mock Claude response');

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
