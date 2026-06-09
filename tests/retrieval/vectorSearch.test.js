process.env.MOCK_MODE = 'true';
const { retrieveRulebookChunks, detectMockSimilarity } = require('../../src/retrieval/vectorSearch');

describe('detectMockSimilarity', () => {
  test('HIGH keyword "ราคา" → 0.91', () => {
    expect(detectMockSimilarity('อยากได้ราคาสินค้า')).toBe(0.91);
  });

  test('HIGH keyword "ใบเสนอราคา" → 0.91', () => {
    expect(detectMockSimilarity('ขอใบเสนอราคาหน่อยครับ')).toBe(0.91);
  });

  test('MEDIUM keyword "สนใจ" → 0.67', () => {
    expect(detectMockSimilarity('ผมสนใจสินค้าตัวนี้อยู่')).toBe(0.67);
  });

  test('MEDIUM keyword "พิจารณา" → 0.67', () => {
    expect(detectMockSimilarity('กำลังพิจารณาอยู่ครับ')).toBe(0.67);
  });

  test('unknown message → 0.28', () => {
    expect(detectMockSimilarity('หมูกรอบอร่อยมาก 5555')).toBe(0.28);
  });

  test('empty string → 0.28', () => {
    expect(detectMockSimilarity('')).toBe(0.28);
  });
});

describe('retrieveRulebookChunks (MOCK_MODE)', () => {
  test('returns 2 chunks for any query', async () => {
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks('test query');
    expect(chunks).toHaveLength(2);
    expect(typeof vectorSimilarity).toBe('number');
  });

  test('all chunks have required metadata fields', async () => {
    const { chunks } = await retrieveRulebookChunks('test');
    for (const chunk of chunks) {
      expect(chunk).toHaveProperty('document_id');
      expect(chunk).toHaveProperty('version');
      expect(chunk).toHaveProperty('section_id');
      expect(chunk).toHaveProperty('effective_date');
      expect(chunk.active_status).toBe(true);
    }
  });

  test('high keyword → vectorSimilarity 0.91', async () => {
    const { vectorSimilarity } = await retrieveRulebookChunks('ขอราคาสินค้าครับ');
    expect(vectorSimilarity).toBe(0.91);
  });

  test('unknown message → vectorSimilarity 0.28', async () => {
    const { vectorSimilarity } = await retrieveRulebookChunks('555555');
    expect(vectorSimilarity).toBe(0.28);
  });
});
