// src/models/TaggingLog.js
const logger = require('pino')();

if (!global.__mockLogs) global.__mockLogs = [];

async function logTagging({ case_id, output }) {
  global.__mockLogs.push({
    type: 'tagged',
    case_id,
    tag: output.answer_summary?.tag,
    confidence: output.confidence_signal?.weighted_final,
    level: output.confidence_signal?.level,
    action: output.recommended_action,
    timestamp: new Date().toISOString()
  });
  logger.debug({ case_id, tag: output.answer_summary?.tag }, 'Tagging log saved');
  return `mock-${Date.now()}`;
}

async function logRefusal({ case_id, ai_suggestion, refusal_reason, confidence_final }) {
  global.__mockLogs.push({
    type: 'refused',
    case_id,
    ai_suggestion,
    refusal_reason,
    confidence_final,
    timestamp: new Date().toISOString()
  });
  logger.debug({ case_id, refusal_reason }, 'Refusal log saved');
  return `mock-${Date.now()}`;
}

async function logCorrection({ case_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason }) {
  global.__mockLogs.push({
    type: 'corrected',
    case_id,
    ai_suggested_tag,
    human_corrected_tag,
    corrected_by,
    correction_reason,
    timestamp: new Date().toISOString()
  });
  logger.debug({ case_id, ai_suggested_tag, human_corrected_tag }, 'Correction log saved');
  return `mock-${Date.now()}`;
}

module.exports = { logTagging, logRefusal, logCorrection };
