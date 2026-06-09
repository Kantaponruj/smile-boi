// src/models/TaggingLog.js
// Database operations สำหรับ tagging_logs, refusal_logs, correction_logs

const { Pool } = require('pg');
const logger = require('pino')();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Tagging Log ─────────────────────────────────────────────────────
async function logTagging({ case_id, output, agent_id }) {
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
    // ไม่ throw — log failure ไม่ควรทำให้ main flow พัง
  }
}

// ─── Refusal Log ─────────────────────────────────────────────────────
async function logRefusal({ case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final }) {
  const query = `
    INSERT INTO refusal_logs (case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      case_id, ai_suggestion, refusal_reason, escalated_to || null, confidence_final || null
    ]);
    logger.debug({ id: result.rows[0].id, case_id }, 'Refusal log saved');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save refusal log');
  }
}

// ─── Correction Log ───────────────────────────────────────────────────
async function logCorrection({ case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason }) {
  const query = `
    INSERT INTO correction_logs (
      case_id, tagging_log_id, ai_suggested_tag,
      human_corrected_tag, corrected_by, correction_reason
    ) VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      case_id, tagging_log_id, ai_suggested_tag,
      human_corrected_tag, corrected_by, correction_reason
    ]);
    logger.info({ id: result.rows[0].id, case_id, human_corrected_tag }, 'Correction logged');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save correction log');
  }
}

module.exports = { logTagging, logRefusal, logCorrection };
