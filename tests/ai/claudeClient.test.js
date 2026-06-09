process.env.MOCK_MODE = 'true';
process.env.MOCK_CLAUDE = 'true';

const { buildMockClaudeResponse } = require('../../src/ai/claudeClient');

describe('buildMockClaudeResponse', () => {
  test('vectorSimilarity 0.91 → #Quotation_Request, llm_self_score 0.90', () => {
    const r = buildMockClaudeResponse(0.91);
    expect(r.answer_summary.tag).toBe('#Quotation_Request');
    expect(r.confidence_signal.llm_self_score).toBe(0.90);
  });

  test('vectorSimilarity 0.67 → #Purchase_Intent, llm_self_score 0.68', () => {
    const r = buildMockClaudeResponse(0.67);
    expect(r.answer_summary.tag).toBe('#Purchase_Intent');
    expect(r.confidence_signal.llm_self_score).toBe(0.68);
  });

  test('vectorSimilarity 0.28 → #General_Inquiry, llm_self_score 0.25', () => {
    const r = buildMockClaudeResponse(0.28);
    expect(r.answer_summary.tag).toBe('#General_Inquiry');
    expect(r.confidence_signal.llm_self_score).toBe(0.25);
    expect(r.missing_information).toBeTruthy();
    expect(r.recommended_action).toBe('refuse');
  });

  test('boundary: 0.8 exactly → high tier (#Quotation_Request)', () => {
    const r = buildMockClaudeResponse(0.8);
    expect(r.answer_summary.tag).toBe('#Quotation_Request');
  });

  test('boundary: 0.6 exactly → medium tier (#Purchase_Intent)', () => {
    const r = buildMockClaudeResponse(0.6);
    expect(r.answer_summary.tag).toBe('#Purchase_Intent');
  });

  test('boundary: 0.59 → low tier (#General_Inquiry)', () => {
    const r = buildMockClaudeResponse(0.59);
    expect(r.answer_summary.tag).toBe('#General_Inquiry');
  });

  test('all tiers have valid source_evidence version format', () => {
    [0.91, 0.67, 0.28].forEach(sim => {
      const r = buildMockClaudeResponse(sim);
      expect(r.source_evidence.version).toMatch(/^v[0-9]+\.[0-9]+$/);
    });
  });
});
