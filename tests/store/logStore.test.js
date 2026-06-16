describe('logStore DB mode', () => {
  let mockDbQuery;

  beforeEach(() => {
    process.env.MOCK_MODE = 'false';
    process.env.DATABASE_URL = 'postgresql://mock';
    jest.resetModules();
    mockDbQuery = jest.fn().mockResolvedValue([]);
    jest.mock('../../src/db/client', () => ({ dbQuery: mockDbQuery }));
  });

  afterEach(() => {
    process.env.MOCK_MODE = 'true';
    delete process.env.DATABASE_URL;
    jest.resetModules();
  });

  test('appendLog inserts to tagging_logs table', async () => {
    const { appendLog } = require('../../src/store/logStore');
    await appendLog({
      case_id: 'LINE-abc12345',
      tag: '#Quotation_Request',
      level: 'high',
      score: 0.87,
      action: 'tag',
      description: 'ขอราคา',
      message: 'ขอใบเสนอราคาหน่อยครับ',
      missing_information: null,
      review_owner: 'admin',
      timestamp: '2026-06-16T10:00:00.000Z',
    });
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tagging_logs'),
      expect.arrayContaining(['LINE-abc12345', '#Quotation_Request'])
    );
  });

  test('getLogs queries tagging_logs with LIMIT', async () => {
    mockDbQuery.mockResolvedValue([{ case_id: 'LINE-test' }]);
    const { getLogs } = require('../../src/store/logStore');
    const result = await getLogs(50);
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [50]
    );
    expect(result).toHaveLength(1);
  });

  test('clearLogs deletes all rows', async () => {
    const { clearLogs } = require('../../src/store/logStore');
    await clearLogs();
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM tagging_logs'),
      []
    );
  });
});

describe('logStore mock mode', () => {
  beforeEach(() => {
    process.env.MOCK_MODE = 'true';
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('appendLog and getLogs work in-memory without DB', async () => {
    const { appendLog, getLogs } = require('../../src/store/logStore');
    await appendLog({ case_id: 'TEST-001', tag: '#Test', timestamp: '2026-01-01T00:00:00Z' });
    const logs = await getLogs(10);
    expect(logs[0].case_id).toBe('TEST-001');
  });
});
