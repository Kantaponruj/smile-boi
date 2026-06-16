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
  test('returns 11 chunks for any query', async () => {
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks('test query');
    expect(chunks).toHaveLength(11);
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

describe('retrieveRulebookChunks (DB mode)', () => {
  beforeEach(() => {
    process.env.MOCK_MODE = 'false';
    process.env.DATABASE_URL = 'postgresql://mock';
    jest.resetModules();
    jest.mock('../../src/db/client', () => ({
      dbQuery: jest.fn().mockResolvedValue([
        {
          id: 'uuid-1',
          document_id: 'corporate-tagging-rulebook',
          version: 'v3.0',
          section_id: '2.3',
          effective_date: '2026-01-01',
          active_status: true,
          scope: 'general',
          access_level: 'agent',
          content: '#Quotation_Request — ลูกค้าส่งข้อความขอราคา'
        }
      ])
    }));
  });

  afterEach(() => {
    process.env.MOCK_MODE = 'true';
    delete process.env.DATABASE_URL;
    jest.resetModules();
  });

  test('returns rows from DB and a numeric vectorSimilarity', async () => {
    const { retrieveRulebookChunks } = require('../../src/retrieval/vectorSearch');
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks('ขอราคา');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].section_id).toBe('2.3');
    expect(typeof vectorSimilarity).toBe('number');
    // per-chunk scoring: query 'ขอราคา' hits HIGH_KEYWORDS → score 0.91
    expect(vectorSimilarity).toBe(0.91);
    expect(chunks[0]).toHaveProperty('_score');
  });

  test('calls dbQuery with active_status=true', async () => {
    const { dbQuery } = require('../../src/db/client');
    const { retrieveRulebookChunks } = require('../../src/retrieval/vectorSearch');
    await retrieveRulebookChunks('test');
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('active_status'),
      [true]
    );
  });

  test('neutral query scores 0.28 (does not match chunk keywords)', async () => {
    const { retrieveRulebookChunks } = require('../../src/retrieval/vectorSearch');
    const { vectorSimilarity, chunks } = await retrieveRulebookChunks('สวัสดีครับ');
    expect(vectorSimilarity).toBe(0.28);
    expect(chunks[0]._score).toBe(0.28);
  });
});
