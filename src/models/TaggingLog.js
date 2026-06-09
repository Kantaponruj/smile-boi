// src/models/TaggingLog.js
const { Pool } = require('pg');
const logger = require('pino')();

const MOCK_MODE = process.env.MOCK_MODE === 'true';

let pool;
if (!MOCK_MODE) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

async function logTagging({ case_id, output, agent_id }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({
      type: 'tagged',
      case_id,
      tag: output.answer_summary?.tag,
      confidence: output.confidence_signal?.weighted_final,
      level: output.confidence_signal?.level,
      action: output.recommended_action,
      timestamp: new Date().toISOString()
    });
    logger.debug({ case_id, tag: output.answer_summary?.tag }, '[MOCK] Tagging log saved');
    return `mock-tagging-${Date.now()}`;
  }

  const query = `
    INSERT INTO tagging_logs (
      case_id, suggested_tag, evidence_doc, evidence_version, evidence_section,
      confidence_vector, confidence_llm, confidence_final, confidence_level,
      recommended_action, review_owner, status, agent_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `;
  const values = [
    case_id,
    output.answer_summary?.tag,
    output.source_evidence?.document,
    output.source_evidence?.version,
    output.source_evidence?.section,
    output.confidence_signal?.vector_similarity,
    output.confidence_signal?.llm_self_score,
    output.confidence_signal?.weighted_final,
    output.confidence_signal?.level,
    output.recommended_action,
    output.review_owner,
    'tagged',
    agent_id || null
  ];
  try {
    const result = await pool.query(query, values);
    logger.debug({ id: result.rows[0].id, case_id }, 'Tagging log saved');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save tagging log');
  }
}

async function logRefusal({ case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({
      type: 'refused',
      case_id,
      ai_suggestion,
      refusal_reason,
      confidence_final,
      timestamp: new Date().toISOString()
    });
    logger.debug({ case_id, refusal_reason }, '[MOCK] Refusal log saved');
    return `mock-refusal-${Date.now()}`;
  }

  const query = `
    INSERT INTO refusal_logs (case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `;
  try {
    const result = await pool.query(query, [case_id, ai_suggestion, refusal_reason, escalated_to || null, confidence_final || null]);
    logger.debug({ id: result.rows[0].id, case_id }, 'Refusal log saved');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save refusal log');
  }
}

async function logCorrection({ case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({ type: 'corrected', case_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason, timestamp: new Date().toISOString() });
    return `mock-correction-${Date.now()}`;
  }

  const query = `
    INSERT INTO correction_logs (case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `;
  try {
    const result = await pool.query(query, [case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason]);
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save correction log');
  }
}

module.exports = { logTagging, logRefusal, logCorrection };
