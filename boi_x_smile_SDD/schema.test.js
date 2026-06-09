// tests/schema.test.js
// Unit tests สำหรับ Output Schema Validator

const { validateOutput, buildRefusalOutput } = require('../src/validation/schemaValidator');
const { calculateConfidence, decideAction } = require('../src/validation/confidenceEngine');

// ─── Mock valid output ────────────────────────────────────────────────
const validOutput = {
  answer_summary: {
    tag: '#Quotation_Request',
    description: 'ลูกค้าต้องการขอราคาสินค้า'
  },
  source_evidence: {
    document: 'Corporate Tagging Rulebook',
    version: 'v3.0',
    section: '2.3',
    effective_date: '2026-01-01'
  },
  confidence_signal: {
    vector_similarity: 0.87,
    llm_self_score: 0.82,
    weighted_final: 0.85,
    level: 'high'
  },
  missing_information: null,
  recommended_action: 'tag',
  review_owner: 'admin'
};

// ─── Schema Validator Tests ───────────────────────────────────────────
describe('validateOutput', () => {
  test('valid output should pass validation', () => {
    const { valid, errors } = validateOutput(validOutput);
    expect(valid).toBe(true);
    expect(errors).toBeNull();
  });

  test('missing answer_summary should fail', () => {
    const { answer_summary, ...incomplete } = validOutput;
    const { valid, errors } = validateOutput(incomplete);
    expect(valid).toBe(false);
    expect(errors).toBeTruthy();
  });

  test('invalid recommended_action enum should fail', () => {
    const bad = { ...validOutput, recommended_action: 'random_action' };
    const { valid } = validateOutput(bad);
    expect(valid).toBe(false);
  });

  test('invalid version format should fail', () => {
    const bad = {
      ...validOutput,
      source_evidence: { ...validOutput.source_evidence, version: '3.0' } // missing "v" prefix
    };
    const { valid } = validateOutput(bad);
    expect(valid).toBe(false);
  });

  test('low confidence with null missing_information should fail (business rule)', () => {
    const lowConf = {
      ...validOutput,
      confidence_signal: { ...validOutput.confidence_signal, level: 'low', weighted_final: 0.45 },
      missing_information: null  // ❌ ต้องไม่ว่างเมื่อ confidence = low
    };
    const { valid, errors } = validateOutput(lowConf);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('missing_information');
  });

  test('low confidence WITH missing_information should pass', () => {
    const lowConf = {
      ...validOutput,
      confidence_signal: { ...validOutput.confidence_signal, level: 'low', weighted_final: 0.45 },
      missing_information: 'ข้อความกำกวม ไม่สามารถระบุเจตนาได้',
      recommended_action: 'refuse'
    };
    const { valid } = validateOutput(lowConf);
    expect(valid).toBe(true);
  });
});

// ─── Confidence Engine Tests ──────────────────────────────────────────
describe('calculateConfidence', () => {
  test('high confidence scores → level high', () => {
    const result = calculateConfidence(0.9, 0.85);
    expect(result.level).toBe('high');
    expect(result.weighted_final).toBeGreaterThanOrEqual(0.8);
  });

  test('medium confidence scores → level medium', () => {
    const result = calculateConfidence(0.7, 0.65);
    expect(result.level).toBe('medium');
    expect(result.weighted_final).toBeGreaterThanOrEqual(0.6);
    expect(result.weighted_final).toBeLessThan(0.8);
  });

  test('low confidence scores → level low', () => {
    const result = calculateConfidence(0.4, 0.5);
    expect(result.level).toBe('low');
    expect(result.weighted_final).toBeLessThan(0.6);
  });

  test('weighted_final = 50/50 average', () => {
    const result = calculateConfidence(0.8, 0.6);
    expect(result.weighted_final).toBe(0.7); // (0.8*0.5) + (0.6*0.5) = 0.7
  });

  test('throws on non-number input', () => {
    expect(() => calculateConfidence('high', 0.8)).toThrow();
  });
});

describe('decideAction', () => {
  test('high confidence → tag', () => {
    expect(decideAction({ level: 'high' })).toBe('tag');
  });

  test('medium confidence → tag_with_flag', () => {
    expect(decideAction({ level: 'medium' })).toBe('tag_with_flag');
  });

  test('low confidence → refuse', () => {
    expect(decideAction({ level: 'low' })).toBe('refuse');
  });
});

// ─── Refusal Output Tests ─────────────────────────────────────────────
describe('buildRefusalOutput', () => {
  test('should build valid refusal structure', () => {
    const refusal = buildRefusalOutput('ข้อความกำกวม');
    expect(refusal.recommended_action).toBe('refuse');
    expect(refusal.review_owner).toBe('supervisor');
    expect(refusal.confidence_signal.level).toBe('low');
    expect(refusal.missing_information).toBe('ข้อความกำกวม');
  });
});
