describe('dbQuery', () => {
  const ORIGINAL_URL = process.env.DATABASE_URL;

  afterEach(() => {
    if (ORIGINAL_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_URL;
    }
    jest.resetModules();
  });

  test('throws synchronously when DATABASE_URL is not set', () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();
    const { dbQuery } = require('../../src/db/client');
    expect(() => dbQuery('SELECT 1', [])).toThrow('DATABASE_URL is not set');
  });
});
