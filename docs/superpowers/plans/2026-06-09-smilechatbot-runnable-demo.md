# smileChatBot Runnable Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Node.js demo of smileChatBot that processes mock LINE webhook payloads through the full AI tagging pipeline using keyword-based mock retrieval and hardcoded mock Claude responses, with in-memory logging and a `npm run demo` test script.

**Architecture:** Express server with 5 layered modules (retrieval → AI → confidence → validation → logging). `MOCK_MODE=true` bypasses LINE signature verification and PostgreSQL. `MOCK_CLAUDE=true` bypasses the real Claude API. A `scripts/demo.js` fires 3 scenario payloads and pretty-prints results via `GET /mock/results`.

**Tech Stack:** Node.js 18+, Express 4, pino, pino-pretty, AJV 8, jest 29, @line/bot-sdk, jsonwebtoken, @anthropic-ai/sdk (mock mode only)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Create | Dependencies + scripts incl. `demo` |
| `.env` | Create | Mock env vars (no real credentials) |
| `src/app.js` | Create | Express app + `/mock/results` endpoint |
| `src/routes/health.js` | Create | GET /health → 200 |
| `src/routes/webhook.js` | Create | POST /webhook + MOCK_MODE signature bypass |
| `src/middleware/jwtAuth.js` | Create | JWT verify + silent block (from SDD) |
| `src/retrieval/vectorSearch.js` | Create | Keyword-based mock similarity detection |
| `src/ai/claudeClient.js` | Create | Mock Claude responses by similarity tier |
| `src/validation/schemaValidator.js` | Create | AJV output schema validation (from SDD) |
| `src/validation/confidenceEngine.js` | Create | Weighted confidence calculator (from SDD) |
| `src/models/TaggingLog.js` | Create | In-memory mock logs (MOCK_MODE) |
| `scripts/demo.js` | Create | Fire 3 scenarios + pretty-print results |
| `tests/schema.test.js` | Create | Tests for schemaValidator + confidenceEngine |
| `tests/retrieval/vectorSearch.test.js` | Create | Tests for keyword detection |
| `tests/ai/claudeClient.test.js` | Create | Tests for mock response by tier |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.env`
- Create directories: `src/routes`, `src/ai`, `src/retrieval`, `src/validation`, `src/middleware`, `src/models`, `scripts`, `tests/retrieval`, `tests/ai`

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p src/routes src/ai src/retrieval src/validation src/middleware src/models scripts tests/retrieval tests/ai
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "smilechatbot",
  "version": "1.0.0",
  "description": "Evidence-Gated, Automated Journey Tagging Engine — LINE OA AI Tagging System",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "demo": "node scripts/demo.js",
    "test": "jest --runInBand",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/ --ext .js",
    "lint:fix": "eslint src/ --ext .js --fix"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "@line/bot-sdk": "^9.5.0",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "helmet": "^7.1.0",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.12.0",
    "pino": "^9.3.1",
    "pino-http": "^10.2.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "eslint": "^9.9.0",
    "jest": "^29.7.0",
    "nodemon": "^3.1.4",
    "pino-pretty": "^11.0.0",
    "supertest": "^7.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/app.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    }
  }
}
```

- [ ] **Step 3: Create .env**

```env
# smileChatBot — Demo Environment
# MOCK_MODE=true bypasses LINE signature + PostgreSQL
# MOCK_CLAUDE=true bypasses real Claude API

MOCK_MODE=true
MOCK_CLAUDE=true

LINE_CHANNEL_SECRET=demo-secret-for-local-testing
LINE_CHANNEL_ACCESS_TOKEN=demo-access-token

JWT_SECRET=demo-jwt-secret-for-local-testing-only-min-64-chars-padding-here
JWT_EXPIRY=8h

ANTHROPIC_API_KEY=demo-key-not-used-in-mock-mode
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_MAX_TOKENS=1000

PORT=3000
NODE_ENV=development
LOG_LEVEL=info

CONFIDENCE_THRESHOLD=0.6
CONFIDENCE_HIGH_THRESHOLD=0.8
CONFIDENCE_WEIGHT_VECTOR=0.5
CONFIDENCE_WEIGHT_LLM=0.5
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git init
git add package.json .env
git commit -m "chore: project scaffold with mock env"
```

---

## Task 2: Validation Layer (schemaValidator + confidenceEngine)

**Files:**
- Create: `src/validation/schemaValidator.js`
- Create: `src/validation/confidenceEngine.js`
- Create: `tests/schema.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/schema.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/schema.test.js --no-coverage 2>&1 | head -20
```

Expected: `Cannot find module '../src/validation/schemaValidator'`

- [ ] **Step 3: Create src/validation/schemaValidator.js**

```js
// src/validation/schemaValidator.js
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const outputSchema = {
  type: 'object',
  required: ['answer_summary', 'source_evidence', 'confidence_signal', 'missing_information', 'recommended_action', 'review_owner'],
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
    missing_information: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    recommended_action:  { type: 'string', enum: ['tag', 'ask_clarification', 'escalate', 'refuse'] },
    review_owner:        { type: 'string', enum: ['admin', 'supervisor'] }
  }
};

const validate = ajv.compile(outputSchema);

function validateOutput(output) {
  const valid = validate(output);
  if (!valid) {
    return { valid: false, errors: validate.errors.map(e => `${e.instancePath || 'root'}: ${e.message}`) };
  }
  if (output.confidence_signal.level === 'low' && output.missing_information === null) {
    return { valid: false, errors: ['missing_information must not be null when confidence level is low'] };
  }
  return { valid: true, errors: null };
}

function buildRefusalOutput(reason) {
  return {
    answer_summary: { tag: null, description: 'ไม่พบข้อมูลที่เพียงพอสำหรับติดแท็ก' },
    source_evidence: null,
    confidence_signal: { vector_similarity: 0, llm_self_score: 0, weighted_final: 0, level: 'low' },
    missing_information: reason || 'ไม่สามารถวิเคราะห์เจตนาได้จากข้อมูลที่มี',
    recommended_action: 'refuse',
    review_owner: 'supervisor'
  };
}

module.exports = { validateOutput, buildRefusalOutput, outputSchema };
```

- [ ] **Step 4: Create src/validation/confidenceEngine.js**

```js
// src/validation/confidenceEngine.js
const WEIGHT_VECTOR = parseFloat(process.env.CONFIDENCE_WEIGHT_VECTOR || '0.5');
const WEIGHT_LLM    = parseFloat(process.env.CONFIDENCE_WEIGHT_LLM    || '0.5');
const THRESHOLD_LOW  = parseFloat(process.env.CONFIDENCE_THRESHOLD      || '0.6');
const THRESHOLD_HIGH = parseFloat(process.env.CONFIDENCE_HIGH_THRESHOLD || '0.8');

function calculateConfidence(vectorSimilarity, llmSelfScore) {
  if (typeof vectorSimilarity !== 'number' || typeof llmSelfScore !== 'number') {
    throw new Error('Confidence scores must be numbers');
  }
  const weightedFinal = vectorSimilarity * WEIGHT_VECTOR + llmSelfScore * WEIGHT_LLM;
  const level = getConfidenceLevel(weightedFinal);
  return {
    vector_similarity: round(vectorSimilarity),
    llm_self_score:    round(llmSelfScore),
    weighted_final:    round(weightedFinal),
    level
  };
}

function getConfidenceLevel(score) {
  if (score >= THRESHOLD_HIGH) return 'high';
  if (score >= THRESHOLD_LOW)  return 'medium';
  return 'low';
}

function decideAction(confidenceResult) {
  switch (confidenceResult.level) {
    case 'high':   return 'tag';
    case 'medium': return 'tag_with_flag';
    case 'low':    return 'refuse';
    default:       return 'refuse';
  }
}

function shouldEscalate(confidenceResult) {
  return confidenceResult.level === 'low';
}

function round(num, decimals = 2) {
  return Math.round(num * 10 ** decimals) / 10 ** decimals;
}

module.exports = { calculateConfidence, getConfidenceLevel, decideAction, shouldEscalate };
```

- [ ] **Step 5: Run tests — expect all to pass**

```bash
npx jest tests/schema.test.js --no-coverage
```

Expected: `Tests: 12 passed`

- [ ] **Step 6: Commit**

```bash
git add src/validation/ tests/schema.test.js
git commit -m "feat: add schemaValidator and confidenceEngine with tests"
```

---

## Task 3: Mock TaggingLog (in-memory)

**Files:**
- Create: `src/models/TaggingLog.js`

- [ ] **Step 1: Create src/models/TaggingLog.js**

```js
// src/models/TaggingLog.js
const { Pool } = require('pg');
const logger = require('pino')();

const MOCK_MODE = process.env.MOCK_MODE === 'true';

let pool;
if (!MOCK_MODE) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

async function logTagging({ case_id, output, agent_id }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({
      type: 'tagged',
      case_id,
      tag: output.answer_summary?.tag,
      confidence: output.confidence_signal?.weighted_final,
      level: output.confidence_signal?.level,
      action: output.recommended_action,
      timestamp: new Date().toISOString()
    });
    logger.debug({ case_id, tag: output.answer_summary?.tag }, '[MOCK] Tagging log saved');
    return `mock-tagging-${Date.now()}`;
  }

  const query = `
    INSERT INTO tagging_logs (
      case_id, suggested_tag, evidence_doc, evidence_version, evidence_section,
      confidence_vector, confidence_llm, confidence_final, confidence_level,
      recommended_action, review_owner, status, agent_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `;
  const values = [
    case_id,
    output.answer_summary?.tag,
    output.source_evidence?.document,
    output.source_evidence?.version,
    output.source_evidence?.section,
    output.confidence_signal?.vector_similarity,
    output.confidence_signal?.llm_self_score,
    output.confidence_signal?.weighted_final,
    output.confidence_signal?.level,
    output.recommended_action,
    output.review_owner,
    'tagged',
    agent_id || null
  ];
  try {
    const result = await pool.query(query, values);
    logger.debug({ id: result.rows[0].id, case_id }, 'Tagging log saved');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save tagging log');
  }
}

async function logRefusal({ case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({
      type: 'refused',
      case_id,
      ai_suggestion,
      refusal_reason,
      confidence_final,
      timestamp: new Date().toISOString()
    });
    logger.debug({ case_id, refusal_reason }, '[MOCK] Refusal log saved');
    return `mock-refusal-${Date.now()}`;
  }

  const query = `
    INSERT INTO refusal_logs (case_id, ai_suggestion, refusal_reason, escalated_to, confidence_final)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `;
  try {
    const result = await pool.query(query, [case_id, ai_suggestion, refusal_reason, escalated_to || null, confidence_final || null]);
    logger.debug({ id: result.rows[0].id, case_id }, 'Refusal log saved');
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save refusal log');
  }
}

async function logCorrection({ case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason }) {
  if (MOCK_MODE) {
    if (!global.__mockLogs) global.__mockLogs = [];
    global.__mockLogs.push({ type: 'corrected', case_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason, timestamp: new Date().toISOString() });
    return `mock-correction-${Date.now()}`;
  }

  const query = `
    INSERT INTO correction_logs (case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `;
  try {
    const result = await pool.query(query, [case_id, tagging_log_id, ai_suggested_tag, human_corrected_tag, corrected_by, correction_reason]);
    return result.rows[0].id;
  } catch (err) {
    logger.error({ err, case_id }, 'Failed to save correction log');
  }
}

module.exports = { logTagging, logRefusal, logCorrection };
```

- [ ] **Step 2: Verify mock mode works inline**

```bash
node -e "
process.env.MOCK_MODE='true';
const { logTagging } = require('./src/models/TaggingLog');
logTagging({ case_id: 'test', output: { answer_summary: { tag: '#Test' }, confidence_signal: { weighted_final: 0.9, level: 'high' }, recommended_action: 'tag' } })
  .then(() => console.log('Mock logs:', global.__mockLogs));
"
```

Expected: `Mock logs: [ { type: 'tagged', case_id: 'test', tag: '#Test', ... } ]`

- [ ] **Step 3: Commit**

```bash
git add src/models/TaggingLog.js
git commit -m "feat: add TaggingLog with in-memory mock mode"
```

---

## Task 4: Mock vectorSearch (keyword detection)

**Files:**
- Create: `src/retrieval/vectorSearch.js`
- Create: `tests/retrieval/vectorSearch.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/retrieval/vectorSearch.test.js`:

```js
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

  test('empty message → 0.28', () => {
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
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest tests/retrieval/vectorSearch.test.js --no-coverage 2>&1 | head -10
```

Expected: `Cannot find module '../../src/retrieval/vectorSearch'`

- [ ] **Step 3: Create src/retrieval/vectorSearch.js**

```js
// src/retrieval/vectorSearch.js
const logger = require('pino')();

const MOCK_MODE = process.env.MOCK_MODE === 'true';

const HIGH_KEYWORDS  = ['ราคา', 'ใบเสนอราคา', 'ขอราคา', 'quotation', 'ใบเสนอ'];
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

async function retrieveRulebookChunks(query, opts = {}) {
  if (MOCK_MODE) {
    const vectorSimilarity = detectMockSimilarity(query);
    logger.debug({ query: query.slice(0, 50), vectorSimilarity }, '[MOCK] Vector search');
    return { chunks: MOCK_CHUNKS, vectorSimilarity };
  }

  const { scope = 'general', accessLevel = 'agent', topK = 5 } = opts;
  const provider = process.env.VECTOR_DB_PROVIDER || 'pgvector';

  try {
    switch (provider) {
      case 'pgvector':
        return await searchPgVector(query, { scope, accessLevel, topK });
      case 'chroma':
        return await searchChroma(query, { scope, accessLevel, topK });
      case 'pinecone':
        return await searchPinecone(query, { scope, accessLevel, topK });
      default:
        throw new Error(`Unsupported VECTOR_DB_PROVIDER: ${provider}`);
    }
  } catch (err) {
    logger.error({ err }, 'Vector search failed');
    return { chunks: [], vectorSimilarity: 0 };
  }
}

async function searchPgVector(query, opts) {
  logger.warn('pgvector search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

async function searchChroma(query, opts) {
  logger.warn('Chroma search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

async function searchPinecone(query, opts) {
  logger.warn('Pinecone search not yet implemented — returning empty');
  return { chunks: [], vectorSimilarity: 0 };
}

module.exports = { retrieveRulebookChunks, detectMockSimilarity };
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx jest tests/retrieval/vectorSearch.test.js --no-coverage
```

Expected: `Tests: 8 passed`

- [ ] **Step 5: Commit**

```bash
git add src/retrieval/vectorSearch.js tests/retrieval/vectorSearch.test.js
git commit -m "feat: add vectorSearch with keyword-based mock detection"
```

---

## Task 5: Mock claudeClient (mock responses by tier)

**Files:**
- Create: `src/ai/claudeClient.js`
- Create: `tests/ai/claudeClient.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/ai/claudeClient.test.js`:

```js
process.env.MOCK_MODE = 'true';
process.env.MOCK_CLAUDE = 'true';

const { buildMockClaudeResponse } = require('../../src/ai/claudeClient');
const { validateOutput } = require('../../src/validation/schemaValidator');

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
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest tests/ai/claudeClient.test.js --no-coverage 2>&1 | head -10
```

Expected: `Cannot find module '../../src/ai/claudeClient'`

- [ ] **Step 3: Create src/ai/claudeClient.js**

```js
// src/ai/claudeClient.js
const { retrieveRulebookChunks } = require('../retrieval/vectorSearch');
const { validateOutput, buildRefusalOutput } = require('../validation/schemaValidator');
const { calculateConfidence, shouldEscalate } = require('../validation/confidenceEngine');
const { logTagging, logRefusal } = require('../models/TaggingLog');
const logger = require('pino')();

const MOCK_CLAUDE = process.env.MOCK_CLAUDE === 'true';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

let client;
if (!MOCK_CLAUDE) {
  const Anthropic = require('@anthropic-ai/sdk');
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function buildMockClaudeResponse(vectorSimilarity) {
  if (vectorSimilarity >= 0.8) {
    return {
      answer_summary: { tag: '#Quotation_Request', description: 'ลูกค้าต้องการขอใบเสนอราคาสินค้า อ้างอิงจาก Rulebook §2.3' },
      source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '2.3', effective_date: '2026-01-01' },
      confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.90, weighted_final: 0, level: 'high' },
      missing_information: null,
      recommended_action: 'tag',
      review_owner: 'admin'
    };
  }
  if (vectorSimilarity >= 0.6) {
    return {
      answer_summary: { tag: '#Purchase_Intent', description: 'ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน อ้างอิงจาก Rulebook §3.1' },
      source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '3.1', effective_date: '2026-01-01' },
      confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.68, weighted_final: 0, level: 'medium' },
      missing_information: null,
      recommended_action: 'tag',
      review_owner: 'admin'
    };
  }
  return {
    answer_summary: { tag: '#General_Inquiry', description: 'ไม่สามารถระบุเจตนาลูกค้าได้อย่างชัดเจนจากข้อมูลที่มี' },
    source_evidence: { document: 'Corporate Tagging Rulebook', version: 'v3.0', section: '1.0', effective_date: '2026-01-01' },
    confidence_signal: { vector_similarity: vectorSimilarity, llm_self_score: 0.25, weighted_final: 0, level: 'low' },
    missing_information: 'ข้อความไม่สอดคล้องกับ Rulebook หมวดใดๆ กรุณาให้ข้อมูลเพิ่มเติมเพื่อระบุเจตนา',
    recommended_action: 'refuse',
    review_owner: 'supervisor'
  };
}

function buildSystemPrompt(rulebookChunks) {
  const chunksText = rulebookChunks
    .map(c => `[${c.document_id} v${c.version} §${c.section_id}]\n${c.content}`)
    .join('\n\n---\n\n');

  return `You are smileChatBot, an Evidence-Gated Intent Tagging Engine for a LINE OA customer service system.

## Your Core Rules (NON-NEGOTIABLE)
1. ALWAYS base your analysis on the provided Rulebook sections — NEVER hallucinate or invent tags
2. If confidence is low (< 0.6), set recommended_action to "refuse" and explain in missing_information
3. ALWAYS return a valid JSON object matching the exact schema — NO free text, NO markdown fences

## Available Rulebook Context
${chunksText}

## Output Schema (return ONLY this JSON, nothing else)
{
  "answer_summary": { "tag": "<tag_name>", "description": "<explanation in Thai>" },
  "source_evidence": { "document": "<name>", "version": "<vX.X>", "section": "<section>", "effective_date": "<YYYY-MM-DD>" },
  "confidence_signal": { "vector_similarity": 0.0, "llm_self_score": 0.0, "weighted_final": 0.0, "level": "high|medium|low" },
  "missing_information": null,
  "recommended_action": "tag|ask_clarification|escalate|refuse",
  "review_owner": "admin|supervisor"
}`;
}

async function processMessage(event) {
  const chatMessage = event.message.text;
  const userId = event.source.userId;
  const caseId = `LINE-${userId.slice(-8)}`;

  logger.info({ caseId, messageLength: chatMessage.length }, 'Processing message');

  try {
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks(chatMessage);

    if (!chunks || chunks.length === 0) {
      const refusal = buildRefusalOutput('ไม่พบ Rulebook ที่ตรงกับข้อความนี้ในฐานข้อมูล');
      await logRefusal({ case_id: caseId, ai_suggestion: null, refusal_reason: 'no_chunks_found' });
      return refusal;
    }

    let parsed;

    if (MOCK_CLAUDE) {
      parsed = buildMockClaudeResponse(vectorSimilarity);
      logger.info({ caseId, vectorSimilarity }, '[MOCK] Using mock Claude response');
    } else {
      const systemPrompt = buildSystemPrompt(chunks);
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1000'),
        system: systemPrompt,
        messages: [{ role: 'user', content: `วิเคราะห์ข้อความแชทต่อไปนี้และระบุเจตนาของลูกค้า:\n\n"${chatMessage}"` }]
      });
      const rawText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (e) {
        logger.error({ caseId, rawText }, 'Failed to parse Claude JSON response');
        return buildRefusalOutput('ระบบ AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
      }
    }

    const confidenceResult = calculateConfidence(vectorSimilarity, parsed.confidence_signal?.llm_self_score || 0);
    parsed.confidence_signal = confidenceResult;

    const { valid, errors } = validateOutput(parsed);
    if (!valid) {
      logger.error({ caseId, errors }, 'Schema validation failed');
      return buildRefusalOutput(`Schema validation failed: ${errors?.join(', ')}`);
    }

    if (shouldEscalate(confidenceResult)) {
      parsed.recommended_action = 'refuse';
      parsed.review_owner = 'supervisor';
      await logRefusal({
        case_id: caseId,
        ai_suggestion: parsed.answer_summary?.tag,
        refusal_reason: `confidence_too_low: ${confidenceResult.weighted_final}`,
        confidence_final: confidenceResult.weighted_final
      });
      logger.info({ caseId, confidence: confidenceResult.weighted_final }, 'Refusing — escalating to human');
    } else {
      await logTagging({ case_id: caseId, output: parsed });
      logger.info({ caseId, tag: parsed.answer_summary?.tag, level: confidenceResult.level }, 'Tagged successfully');
    }

    return parsed;

  } catch (err) {
    logger.error({ err, caseId }, 'Unexpected error in processMessage');
    return buildRefusalOutput('เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่หรือติดต่อ Supervisor');
  }
}

module.exports = { processMessage, buildMockClaudeResponse };
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx jest tests/ai/claudeClient.test.js --no-coverage
```

Expected: `Tests: 7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/ai/claudeClient.js tests/ai/claudeClient.test.js
git commit -m "feat: add claudeClient with mock response tiers"
```

---

## Task 6: Routes + App

**Files:**
- Create: `src/routes/health.js`
- Create: `src/middleware/jwtAuth.js`
- Create: `src/routes/webhook.js`
- Create: `src/app.js`

- [ ] **Step 1: Create src/routes/health.js**

```js
// src/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mock: process.env.MOCK_MODE === 'true' });
});

module.exports = router;
```

- [ ] **Step 2: Create src/middleware/jwtAuth.js**

```js
// src/middleware/jwtAuth.js
const jwt = require('jsonwebtoken');
const logger = require('pino')();

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret);
}

function accessMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return res.status(404).json({ error: 'Not found' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    return res.status(404).json({ error: 'Not found' });
  }

  const caseId = req.body?.case_id || req.query?.case_id;
  if (decoded.role === 'agent' && caseId && !decoded.assigned_cases?.includes(caseId)) {
    logger.warn({ user_id: decoded.user_id, caseId }, 'Unauthorized case access (silent block)');
    return res.status(404).json({ error: 'Not found' });
  }

  req.user = decoded;
  next();
}

function createToken(payload) {
  const secret = process.env.JWT_SECRET;
  const expiry = process.env.JWT_EXPIRY || '8h';
  return jwt.sign(payload, secret, { expiresIn: expiry });
}

function hasAccessLevel(userRole, requiredLevel) {
  const levelMap = { agent: 1, supervisor: 2, admin: 3 };
  return (levelMap[userRole] || 0) >= (levelMap[requiredLevel] || 99);
}

module.exports = { accessMiddleware, verifyToken, createToken, hasAccessLevel };
```

- [ ] **Step 3: Create src/routes/webhook.js**

```js
// src/routes/webhook.js
const express = require('express');
const crypto = require('crypto');
const { processMessage } = require('../ai/claudeClient');
const logger = require('pino')();

const router = express.Router();

function verifyLineSignature(rawBody, signature) {
  if (process.env.MOCK_MODE === 'true') return true;

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) throw new Error('LINE_CHANNEL_SECRET not set');

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
    .digest('base64');

  return hash === signature;
}

router.post('/', (req, res) => {
  const signature = req.headers['x-line-signature'];

  if (!signature || !verifyLineSignature(req.body, signature)) {
    logger.warn('Invalid LINE signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    logger.warn('Failed to parse webhook body');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  res.status(200).send('OK');

  if (body.events && body.events.length > 0) {
    for (const event of body.events) {
      processEvent(event).catch(err => {
        logger.error({ err, event }, 'Failed to process event');
      });
    }
  }
});

async function processEvent(event) {
  logger.info({ eventType: event.type, source: event.source }, 'Processing event');

  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        await processMessage(event);
      }
      break;
    case 'follow':
      logger.info({ userId: event.source.userId }, 'New follower');
      break;
    case 'unfollow':
      logger.info({ userId: event.source.userId }, 'Unfollowed');
      break;
    case 'postback':
      logger.info({ data: event.postback.data }, 'Postback received');
      break;
    default:
      logger.debug({ eventType: event.type }, 'Unhandled event type');
  }
}

module.exports = router;
```

- [ ] **Step 4: Create src/app.js**

```js
// src/app.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { pino } = require('pino');
const pinoHttp = require('pino-http');

const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : '*'
}));
app.use(pinoHttp({ logger }));

// LINE SDK requires raw body for signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);

if (process.env.MOCK_MODE === 'true') {
  global.__mockLogs = [];

  app.get('/mock/results', (req, res) => {
    res.json({ logs: global.__mockLogs || [] });
  });

  app.post('/mock/reset', (req, res) => {
    global.__mockLogs = [];
    res.json({ ok: true, message: 'Mock logs cleared' });
  });

  logger.info('MOCK_MODE enabled: /mock/results and /mock/reset available');
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`smileChatBot listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'} | MOCK_MODE: ${process.env.MOCK_MODE}`);
});

module.exports = app;
```

- [ ] **Step 5: Start server to verify no crash**

```bash
node src/app.js &
sleep 2
curl http://localhost:3000/health
kill %1
```

Expected: `{"status":"ok","timestamp":"...","mock":true}`

- [ ] **Step 6: Commit**

```bash
git add src/routes/ src/middleware/ src/app.js
git commit -m "feat: add Express server with webhook and mock endpoints"
```

---

## Task 7: Demo Script

**Files:**
- Create: `scripts/demo.js`

- [ ] **Step 1: Create scripts/demo.js**

```js
#!/usr/bin/env node
// scripts/demo.js — run: npm run demo (server must be running: npm start)
require('dotenv').config();

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

const SCENARIOS = [
  {
    name: 'HIGH CONFIDENCE',
    emoji: '✅',
    message: 'อยากได้ใบเสนอราคา 5 ชิ้นครับ',
    userId: 'Uf11111111'
  },
  {
    name: 'MEDIUM CONFIDENCE (Spot-check)',
    emoji: '⚠️ ',
    message: 'กำลังพิจารณาสินค้าอยู่ ยังไม่แน่ใจว่าจะซื้อ',
    userId: 'Uf22222222'
  },
  {
    name: 'LOW CONFIDENCE (Refusal)',
    emoji: '🚫',
    message: 'หมูกรอบอร่อยมาก 5555',
    userId: 'Uf33333333'
  }
];

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m'
};

function buildLinePayload(message, userId) {
  return JSON.stringify({
    destination: 'Ubotdemo123456',
    events: [{
      type: 'message',
      message: { type: 'text', id: `msg-${Date.now()}`, text: message },
      source: { type: 'user', userId },
      replyToken: `reply-${Date.now()}`,
      timestamp: Date.now(),
      mode: 'active'
    }]
  });
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data || ''),
        'x-line-signature': 'mock-bypass'
      }
    };
    const req = http.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function printScenario(scenario, log) {
  const levelColor = { high: C.green, medium: C.yellow, low: C.red };

  console.log(`\n${C.bold}[${scenario.emoji}  SCENARIO: ${scenario.name}]${C.reset}`);
  console.log(`${'─'.repeat(57)}`);
  console.log(`${C.cyan}📨 Message :${C.reset} "${scenario.message}"`);

  if (!log) {
    console.log(`${C.red}❌ No result captured — check server logs${C.reset}`);
    return;
  }

  if (log.type === 'refused') {
    console.log(`${C.red}🚫 REFUSED${C.reset}  — Escalated to Supervisor`);
    console.log(`${C.gray}⚠️  Reason  : ${log.refusal_reason}${C.reset}`);
    console.log(`${C.red}📊 Confidence: ${log.confidence_final} (low)${C.reset}`);
    console.log(`${C.gray}🎯 Action  : refuse → human review${C.reset}`);
  } else {
    const color = levelColor[log.level] || C.reset;
    const spotFlag = log.level === 'medium' ? ` ${C.yellow}← SPOT-CHECK REQUIRED${C.reset}` : '';
    console.log(`${color}🏷️  Tag      : ${log.tag}${C.reset}${spotFlag}`);
    console.log(`${color}📊 Confidence: ${log.confidence} (${log.level})${C.reset}`);
    console.log(`${C.cyan}🎯 Action  : ${log.action}${C.reset}`);
  }
}

async function run() {
  console.log(`\n${C.bold}${C.cyan}🚀 smileChatBot — Demo Runner${C.reset}`);
  console.log(`${'━'.repeat(57)}`);
  console.log(`${C.cyan}Server :${C.reset} ${BASE}`);
  console.log(`${C.cyan}Mode   :${C.reset} MOCK_MODE=true | MOCK_CLAUDE=true`);
  console.log(`${C.cyan}Scenarios :${C.reset} ${SCENARIOS.length} (HIGH / MEDIUM / LOW)\n`);

  // Health check
  try {
    await request('GET', '/health');
    console.log(`${C.green}✓ Server is running${C.reset}`);
  } catch {
    console.error(`${C.red}✗ Server not reachable at ${BASE}${C.reset}`);
    console.error(`  Start server first: ${C.bold}npm start${C.reset}\n`);
    process.exit(1);
  }

  // Reset mock logs
  await request('POST', '/mock/reset', {});
  console.log(`${C.gray}✓ Mock logs cleared${C.reset}\n`);

  // Fire all 3 scenarios
  console.log(`${C.bold}Firing scenarios...${C.reset}`);
  for (const s of SCENARIOS) {
    const payload = buildLinePayload(s.message, s.userId);
    const { status } = await request('POST', '/webhook', payload);
    console.log(`  ${status === 200 ? C.green + '✓' : C.red + '✗'}${C.reset} ${s.name} → HTTP ${status}`);
    await sleep(300);
  }

  // Wait for async processing
  await sleep(600);

  // Fetch results
  const { body } = await request('GET', '/mock/results');
  const logs = body.logs || [];

  console.log(`\n${C.bold}Results:${C.reset}`);

  for (const scenario of SCENARIOS) {
    const caseId = `LINE-${scenario.userId.slice(-8)}`;
    const log = logs.find(l => l.case_id === caseId);
    printScenario(scenario, log);
  }

  const tagged  = logs.filter(l => l.type === 'tagged').length;
  const refused = logs.filter(l => l.type === 'refused').length;

  console.log(`\n${'━'.repeat(57)}`);
  console.log(`${C.bold}📋 Summary: ${C.green}${tagged} tagged${C.reset}  ${C.red}${refused} refused${C.reset}  (${logs.length} total)${C.reset}\n`);
}

run().catch(err => {
  console.error(`\n${C.red}Demo failed:${C.reset}`, err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify script is executable**

```bash
node scripts/demo.js --help 2>&1 | head -5 || echo "Script loads OK"
```

Expected: No syntax errors printed.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo.js
git commit -m "feat: add demo script for 3-scenario mock LINE flow"
```

---

## Task 8: Full Run Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All test suites pass. Zero failures.

- [ ] **Step 2: Start server in background**

```bash
node src/app.js &
sleep 2
```

Expected: Console shows `smileChatBot listening on port 3000` and `MOCK_MODE enabled`.

- [ ] **Step 3: Run the demo**

```bash
npm run demo
```

Expected output (3 scenarios with colored output):
```
🚀 smileChatBot — Demo Runner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[✅  SCENARIO: HIGH CONFIDENCE]
─────────────────────────────────────────────────────────
📨 Message : "อยากได้ใบเสนอราคา 5 ชิ้นครับ"
🏷️  Tag      : #Quotation_Request
📊 Confidence: 0.91 (high)
🎯 Action  : tag

[⚠️   SCENARIO: MEDIUM CONFIDENCE (Spot-check)]
─────────────────────────────────────────────────────────
📨 Message : "กำลังพิจารณาสินค้าอยู่ ยังไม่แน่ใจว่าจะซื้อ"
🏷️  Tag      : #Purchase_Intent ← SPOT-CHECK REQUIRED
📊 Confidence: 0.68 (medium)
🎯 Action  : tag

[🚫 SCENARIO: LOW CONFIDENCE (Refusal)]
─────────────────────────────────────────────────────────
📨 Message : "หมูกรอบอร่อยมาก 5555"
🚫 REFUSED  — Escalated to Supervisor
⚠️  Reason  : confidence_too_low: 0.27
📊 Confidence: 0.27 (low)
🎯 Action  : refuse → human review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Summary: 2 tagged  1 refused  (3 total)
```

- [ ] **Step 4: Stop server and commit**

```bash
kill %1
git add .
git commit -m "chore: verify full demo run passes all 3 scenarios"
```
