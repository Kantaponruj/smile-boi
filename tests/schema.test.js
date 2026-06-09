const { validateOutput, buildRefusalOutput } = require('../src/validation/schemaValidator');
const { calculateConfidence, decideAction } = require('../src/validation/confidenceEngine');

const validOutput = {
  answer_summary: { tag: '#Quotation_Request', description: 'ลูกค้าต้องการขอราคาสินค้า' },
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

describe('validateOutput', () => {
  test('valid output passes', () => {
    const { valid, errors } = validateOutput(validOutput);
    expect(valid).toBe(true);
    expect(errors).toBeNull();
  });

  test('missing answer_summary fails', () => {
    const { answer_summary, ...incomplete } = validOutput;
    const { valid } = validateOutput(incomplete);
    expect(valid).toBe(false);
  });

  test('invalid recommended_action enum fails', () => {
    const { valid } = validateOutput({ ...validOutput, recommended_action: 'random_action' });
    expect(valid).toBe(false);
  });

  test('invalid version format fails (missing v prefix)', () => {
    const bad = { ...validOutput, source_evidence: { ...validOutput.source_evidence, version: '3.0' } };
    const { valid } = validateOutput(bad);
    expect(valid).toBe(false);
  });

  test('low confidence + null missing_information fails (business rule)', () => {
    const low = {
      ...validOutput,
      confidence_signal: { ...validOutput.confidence_signal, level: 'low', weighted_final: 0.45 },
      missing_information: null
    };
    const { valid, errors } = validateOutput(low);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('missing_information');
  });

  test('low confidence + missing_information filled passes', () => {
    const low = {
      ...validOutput,
      confidence_signal: { ...validOutput.confidence_signal, level: 'low', weighted_final: 0.45 },
      missing_information: 'ข้อความกำกวม ไม่สามารถระบุเจตนาได้',
      recommended_action: 'refuse'
    };
    const { valid } = validateOutput(low);
    expect(valid).toBe(true);
  });
});

describe('calculateConfidence', () => {
  test('high scores → level high', () => {
    const result = calculateConfidence(0.9, 0.85);
    expect(result.level).toBe('high');
    expect(result.weighted_final).toBeGreaterThanOrEqual(0.8);
  });

  test('medium scores → level medium', () => {
    const result = calculateConfidence(0.7, 0.65);
    expect(result.level).toBe('medium');
    expect(result.weighted_final).toBeGreaterThanOrEqual(0.6);
    expect(result.weighted_final).toBeLessThan(0.8);
  });

  test('low scores → level low', () => {
    const result = calculateConfidence(0.4, 0.5);
    expect(result.level).toBe('low');
    expect(result.weighted_final).toBeLessThan(0.6);
  });

  test('weighted_final is 50/50 average', () => {
    const result = calculateConfidence(0.8, 0.6);
    expect(result.weighted_final).toBe(0.7);
  });

  test('throws on non-number input', () => {
    expect(() => calculateConfidence('high', 0.8)).toThrow();
  });

  test('throws on out-of-range input (> 1)', () => {
    expect(() => calculateConfidence(1.5, 0.8)).toThrow();
  });
});

describe('decideAction', () => {
  test('high → tag', () => expect(decideAction({ level: 'high' })).toBe('tag'));
  test('medium → tag_with_flag', () => expect(decideAction({ level: 'medium' })).toBe('tag_with_flag'));
  test('low → refuse', () => expect(decideAction({ level: 'low' })).toBe('refuse'));
});

describe('buildRefusalOutput', () => {
  test('builds valid refusal structure', () => {
    const r = buildRefusalOutput('ข้อความกำกวม');
    expect(r.recommended_action).toBe('refuse');
    expect(r.review_owner).toBe('supervisor');
    expect(r.confidence_signal.level).toBe('low');
    expect(r.missing_information).toBe('ข้อความกำกวม');
  });
});

describe('shouldEscalate', () => {
  const { shouldEscalate } = require('../src/validation/confidenceEngine');
  test('low → true', () => expect(shouldEscalate({ level: 'low' })).toBe(true));
  test('medium → false', () => expect(shouldEscalate({ level: 'medium' })).toBe(false));
  test('high → false', () => expect(shouldEscalate({ level: 'high' })).toBe(false));
});
