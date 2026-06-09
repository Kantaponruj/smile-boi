async function logTagging({ case_id, output }) {
  console.log('[TaggingLog] tagged:', case_id, output?.answer_summary?.tag)
  return `mock-${Date.now()}`
}

async function logRefusal({ case_id, ai_suggestion, refusal_reason, confidence_final }) {
  console.log('[TaggingLog] refused:', case_id, refusal_reason, confidence_final)
  return `mock-${Date.now()}`
}

async function logCorrection({ case_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason }) {
  console.log('[TaggingLog] corrected:', case_id, ai_suggested_tag, '->', human_corrected_tag)
  return `mock-${Date.now()}`
}

module.exports = { logTagging, logRefusal, logCorrection }
