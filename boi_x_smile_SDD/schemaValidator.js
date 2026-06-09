// src/validation/schemaValidator.js
// ตรวจสอบ Output Schema ที่ Claude ส่งกลับมาว่าถูกต้องหรือไม่

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

// ─── Output Schema Definition ────────────────────────────────────────
const outputSchema = {
  type: 'object',
  required: [
    'answer_summary',
    'source_evidence',
    'confidence_signal',
    'missing_information',
    'recommended_action',
    'review_owner'
  ],
  additionalProperties: false,
  properties: {
    answer_summary: {
      type: 'object',
      required: ['tag', 'description'],
      additionalProperties: false,
      properties: {
        tag:         { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 }
      }
    },
    source_evidence: {
      type: 'object',
      required: ['document', 'version', 'section', 'effective_date'],
      additionalProperties: false,
      properties: {
        document:       { type: 'string', minLength: 1 },
        version:        { type: 'string', pattern: '^v[0-9]+\\.[0-9]+$' },
        section:        { type: 'string', minLength: 1 },
        effective_date: { type: 'string', format: 'date' }
      }
    },
    confidence_signal: {
      type: 'object',
      required: ['vector_similarity', 'llm_self_score', 'weighted_final', 'level'],
      additionalProperties: false,
      properties: {
        vector_similarity: { type: 'number', minimum: 0, maximum: 1 },
        llm_self_score:    { type: 'number', minimum: 0, maximum: 1 },
        weighted_final:    { type: 'number', minimum: 0, maximum: 1 },
        level:             { type: 'string', enum: ['high', 'medium', 'low'] }
      }
    },
    missing_information: {
      oneOf: [
        { type: 'string', minLength: 1 },
        { type: 'null' }
      ]
    },
    recommended_action: {
      type: 'string',
      enum: ['tag', 'ask_clarification', 'escalate', 'refuse']
    },
    review_owner: {
      type: 'string',
      enum: ['admin', 'supervisor']
    }
  }
};

const validate = ajv.compile(outputSchema);

/**
 * ตรวจสอบ output จาก Claude API
 * @param {object} output - parsed JSON จาก Claude
 * @returns {{ valid: boolean, errors: string[] | null }}
 */
function validateOutput(output) {
  const valid = validate(output);

  if (!valid) {
    const errors = validate.errors.map(
      (e) => `${e.instancePath || 'root'}: ${e.message}`
    );
    return { valid: false, errors };
  }

  // Business rule: missing_information ต้องไม่ว่างเปล่าถ้า confidence = low
  if (
    output.confidence_signal.level === 'low' &&
    output.missing_information === null
  ) {
    return {
      valid: false,
      errors: ['missing_information must not be null when confidence level is low']
    };
  }

  return { valid: true, errors: null };
}

/**
 * สร้าง refusal output เมื่อ validation ไม่ผ่าน
 */
function buildRefusalOutput(reason) {
  return {
    answer_summary: {
      tag: null,
      description: 'ไม่พบข้อมูลที่เพียงพอสำหรับติดแท็ก'
    },
    source_evidence: null,
    confidence_signal: {
      vector_similarity: 0,
      llm_self_score: 0,
      weighted_final: 0,
      level: 'low'
    },
    missing_information: reason || 'ไม่สามารถวิเคราะห์เจตนาได้จากข้อมูลที่มี',
    recommended_action: 'refuse',
    review_owner: 'supervisor'
  };
}

module.exports = { validateOutput, buildRefusalOutput, outputSchema };
