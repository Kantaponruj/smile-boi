# Real Backend with Neon + pgvector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all in-memory/KV mock storage with real Neon Postgres, while keeping MOCK_MODE=true fast-path intact for unit tests.

**Architecture:** Add `src/db/client.js` as a thin Neon wrapper. `vectorSearch.js` queries `rulebook_chunks` table when `MOCK_MODE=false`; `logStore.js` inserts/reads from `tagging_logs` table. All existing MOCK_MODE=true tests continue to pass untouched.

**Tech Stack:** `@neondatabase/serverless`, Neon Postgres (free tier), pgvector extension, Jest (existing)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/db/client.js` | Neon connection, exports `dbQuery(text, params)` |
| Create | `scripts/seed-db.js` | One-time: CREATE tables + INSERT rulebook chunks |
| Create | `tests/db/client.test.js` | Unit test for DB client error path |
| Create | `tests/store/logStore.test.js` | Unit tests for logStore DB path |
| Modify | `src/retrieval/vectorSearch.js` | Add DB path when MOCK_MODE=false |
| Modify | `src/store/logStore.js` | Replace KV with Neon INSERT/SELECT |
| Modify | `tests/retrieval/vectorSearch.test.js` | Add DB path tests |
| Modify | `app/api/health/route.js` | Add DB ping in non-mock mode |
| Modify | `package.json` | Add `db:seed` script |

---

## Task 1: Install Neon driver + create DB client

**Files:**
- Create: `src/db/client.js`
- Create: `tests/db/client.test.js`

- [ ] **Step 1: Install `@neondatabase/serverless`**

```bash
npm install @neondatabase/serverless
```

Expected: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `tests/db/client.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tests/db/client.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/db/client'`

- [ ] **Step 4: Create `src/db/client.js`**

```js
// src/db/client.js
const { neon } = require('@neondatabase/serverless');

function dbQuery(text, params) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  return sql(text, params);
}

module.exports = { dbQuery };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tests/db/client.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 6: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/db/client.js tests/db/client.test.js package.json package-lock.json
git commit -m "feat: add Neon DB client wrapper"
```

---

## Task 2: Seed script — create tables and insert rulebook chunks

**Files:**
- Create: `scripts/seed-db.js`
- Modify: `package.json` (add `db:seed` script)

- [ ] **Step 1: Install dotenv for seed script**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 2: Create `scripts/seed-db.js`**

```js
// scripts/seed-db.js
// Run once: node scripts/seed-db.js
// Requires DATABASE_URL in .env.local
require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL in .env.local before seeding');

  const sql = neon(url);

  await sql('CREATE EXTENSION IF NOT EXISTS vector');

  await sql(`
    CREATE TABLE IF NOT EXISTS rulebook_chunks (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id    TEXT NOT NULL,
      version        TEXT NOT NULL,
      section_id     TEXT NOT NULL,
      effective_date DATE NOT NULL,
      active_status  BOOLEAN NOT NULL DEFAULT true,
      scope          TEXT NOT NULL DEFAULT 'general',
      access_level   TEXT NOT NULL DEFAULT 'agent',
      content        TEXT NOT NULL,
      embedding      vector(1536)
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS tagging_logs (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id             TEXT NOT NULL,
      tag                 TEXT,
      level               TEXT,
      score               FLOAT,
      action              TEXT,
      description         TEXT,
      message             TEXT,
      missing_information TEXT,
      review_owner        TEXT,
      timestamp           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const existing = await sql('SELECT 1 FROM rulebook_chunks WHERE version = $1 LIMIT 1', ['v3.0']);
  if (existing.length === 0) {
    await sql(`
      INSERT INTO rulebook_chunks (document_id, version, section_id, effective_date, scope, access_level, content)
      VALUES
        ($1, $2, $3, $4::date, $5, $6, $7),
        ($1, $2, $8, $4::date, $5, $6, $9),
        ($1, $2, $10, $4::date, $5, $6, $11)
    `, [
      'corporate-tagging-rulebook', 'v3.0',
      '1.0', '2026-01-01', 'general', 'agent',
      '#General_Inquiry — ข้อความทั่วไปที่ไม่สามารถระบุเจตนาได้ เช่น "สวัสดี", "ขอถามหน่อย"',
      '2.3',
      '#Quotation_Request — ลูกค้าส่งข้อความขอราคาหรือใบเสนอราคา เช่น "ขอใบเสนอราคา", "ราคาเท่าไหร่", "สั่งซื้อจำนวนมากได้ไหม"',
      '3.1',
      '#Purchase_Intent — ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน เช่น "กำลังพิจารณา", "สนใจอยู่", "น่าสนใจดี"',
    ]);
    console.log('Rulebook chunks seeded (3 rows)');
  } else {
    console.log('Rulebook chunks already exist — skipping seed');
  }

  console.log('Done.');
}

seed().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Add `db:seed` script to `package.json`**

In `package.json`, add to `"scripts"`:

```json
"db:seed": "node scripts/seed-db.js"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-db.js package.json package-lock.json
git commit -m "feat: add DB seed script for rulebook_chunks and tagging_logs tables"
```

---

## Task 3: Update `vectorSearch.js` to query real DB

**Files:**
- Modify: `src/retrieval/vectorSearch.js`
- Modify: `tests/retrieval/vectorSearch.test.js`

- [ ] **Step 1: Add DB path tests**

Append to `tests/retrieval/vectorSearch.test.js`:

```js
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
});
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx jest tests/retrieval/vectorSearch.test.js --no-coverage
```

Expected: the two new `DB mode` tests FAIL; the existing `MOCK_MODE` tests still PASS.

- [ ] **Step 3: Update `src/retrieval/vectorSearch.js`**

Replace the file content with:

```js
// src/retrieval/vectorSearch.js
const logger = require('pino')();
const { dbQuery } = require('../db/client');

const HIGH_KEYWORDS   = ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ'];
const MEDIUM_KEYWORDS = ['สนใจ', 'กำลังพิจารณา', 'พิจารณา', 'กำลังคิด', 'น่าสนใจ', 'คิดจะ'];

const MOCK_CHUNKS = [
  {
    document_id: 'corporate-tagging-rulebook',
    version: 'v3.0',
    section_id: '2.3',
    effective_date: '2026-01-01',
    active_status: true,
    scope: 'general',
    access_level: 'agent',
    content: '#Quotation_Request — ลูกค้าส่งข้อความขอราคาหรือใบเสนอราคา เช่น "ขอใบเสนอราคา", "ราคาเท่าไหร่", "สั่งซื้อจำนวนมากได้ไหม"'
  },
  {
    document_id: 'corporate-tagging-rulebook',
    version: 'v3.0',
    section_id: '3.1',
    effective_date: '2026-01-01',
    active_status: true,
    scope: 'general',
    access_level: 'agent',
    content: '#Purchase_Intent — ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน เช่น "กำลังพิจารณา", "สนใจอยู่", "น่าสนใจดี"'
  }
];

function detectMockSimilarity(query) {
  const q = query.toLowerCase();
  if (HIGH_KEYWORDS.some(kw => q.includes(kw)))   return 0.91;
  if (MEDIUM_KEYWORDS.some(kw => q.includes(kw))) return 0.67;
  return 0.28;
}

async function retrieveRulebookChunks(query) {
  const isMock = process.env.MOCK_MODE !== 'false';

  if (isMock) {
    const vectorSimilarity = detectMockSimilarity(query);
    logger.debug({ query: query.slice(0, 50), vectorSimilarity }, 'Vector search (mock)');
    return { chunks: MOCK_CHUNKS, vectorSimilarity };
  }

  const rows = await dbQuery(
    `SELECT id, document_id, version, section_id, effective_date,
            active_status, scope, access_level, content
     FROM rulebook_chunks
     WHERE active_status = $1
     ORDER BY effective_date DESC`,
    [true]
  );

  const vectorSimilarity = detectMockSimilarity(query);
  logger.debug({ query: query.slice(0, 50), vectorSimilarity, rowCount: rows.length }, 'Vector search (db)');

  return { chunks: rows, vectorSimilarity };
}

module.exports = { retrieveRulebookChunks, detectMockSimilarity };
```

- [ ] **Step 4: Run all vectorSearch tests**

```bash
npx jest tests/retrieval/vectorSearch.test.js --no-coverage
```

Expected: all tests PASS (both mock and DB path).

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/retrieval/vectorSearch.js tests/retrieval/vectorSearch.test.js
git commit -m "feat: vectorSearch queries Neon DB when MOCK_MODE=false"
```

---

## Task 4: Update `logStore.js` to use Neon

**Files:**
- Modify: `src/store/logStore.js`
- Create: `tests/store/logStore.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/store/logStore.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/store/logStore.test.js --no-coverage
```

Expected: FAIL — the DB mode tests fail because logStore still uses KV/in-memory.

- [ ] **Step 3: Replace `src/store/logStore.js`**

```js
// src/store/logStore.js
const { dbQuery } = require('../db/client');

let memStore = [];

function useDb() {
  return process.env.MOCK_MODE !== 'false' ? false : !!process.env.DATABASE_URL;
}

async function appendLog(entry) {
  if (useDb()) {
    await dbQuery(
      `INSERT INTO tagging_logs
         (case_id, tag, level, score, action, description, message, missing_information, review_owner, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.case_id,
        entry.tag ?? null,
        entry.level ?? null,
        entry.score ?? null,
        entry.action ?? null,
        entry.description ?? null,
        entry.message ?? null,
        entry.missing_information ?? null,
        entry.review_owner ?? null,
        entry.timestamp ?? new Date().toISOString(),
      ]
    );
    return;
  }
  memStore.unshift(entry);
  if (memStore.length > 200) memStore = memStore.slice(0, 200);
}

async function getLogs(limit = 100) {
  if (useDb()) {
    return dbQuery(
      'SELECT * FROM tagging_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
  }
  return memStore.slice(0, limit);
}

async function clearLogs() {
  if (useDb()) {
    await dbQuery('DELETE FROM tagging_logs', []);
    return;
  }
  memStore = [];
}

module.exports = { appendLog, getLogs, clearLogs };
```

- [ ] **Step 4: Run logStore tests**

```bash
npx jest tests/store/logStore.test.js --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/logStore.js tests/store/logStore.test.js
git commit -m "feat: logStore writes to Neon tagging_logs when MOCK_MODE=false"
```

---

## Task 5: Update health endpoint + add .env.local template

**Files:**
- Modify: `app/api/health/route.js`
- Create: `.env.local.example`

- [ ] **Step 1: Update `app/api/health/route.js`**

Replace the file content with:

```js
export const runtime = 'nodejs'

export async function GET() {
  const isMock = process.env.MOCK_MODE !== 'false'
  let db = 'skipped'

  if (!isMock && process.env.DATABASE_URL) {
    try {
      const { dbQuery } = await import('../../../src/db/client')
      await dbQuery('SELECT 1', [])
      db = 'ok'
    } catch {
      db = 'error'
    }
  }

  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mock: isMock,
    db,
  })
}
```

- [ ] **Step 2: Create `.env.local.example`**

```
# Copy to .env.local and fill in values
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
MOCK_MODE=false
LINE_CHANNEL_SECRET=your_line_channel_secret_here
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/health/route.js .env.local.example
git commit -m "feat: health endpoint reports DB status + add .env.local.example"
```

---

## Neon Setup Checklist (do after all tasks)

Once code is complete, do these manually:

1. Create Neon project at console.neon.tech (free tier)
2. Copy connection string → `.env.local` as `DATABASE_URL`
3. Set `MOCK_MODE=false` in `.env.local`
4. Run: `npm run db:seed`
5. Start dev server: `npm run dev`
6. Hit `GET /api/health` → should show `"db": "ok"`
7. Hit `POST /api/webhook` with a LINE event → check `GET /api/admin` shows log row in DB
