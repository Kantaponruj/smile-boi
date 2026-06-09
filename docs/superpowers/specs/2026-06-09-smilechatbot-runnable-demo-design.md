# smileChatBot — Runnable Demo Design

> Date: 2026-06-09 | Status: Approved

## Goal

Runnable Node.js demo that simulates the full smileChatBot pipeline (LINE webhook → RAG → Confidence Engine → structured JSON response) using mock data — no real LINE OA, no real Claude API, no real database required.

## Project Structure

```
smile-boi/
├── src/
│   ├── app.js
│   ├── routes/webhook.js        ← bypass signature if MOCK_MODE=true
│   ├── routes/health.js
│   ├── ai/claudeClient.js       ← mock response if MOCK_CLAUDE=true
│   ├── retrieval/vectorSearch.js ← keyword-based mock similarity
│   ├── validation/schemaValidator.js
│   ├── validation/confidenceEngine.js
│   ├── middleware/jwtAuth.js
│   └── models/TaggingLog.js     ← in-memory if MOCK_MODE=true
├── scripts/demo.js
├── .env.example
└── package.json
```

## Mock Strategy

### vectorSearch.js — keyword detection
| Keyword in message | vectorSimilarity | Scenario |
|---|---|---|
| "ราคา", "ใบเสนอ", "quotation" | 0.91 | HIGH |
| "สนใจ", "กำลังคิด", "พิจารณา" | 0.67 | MEDIUM |
| anything else | 0.28 | LOW |

Always returns 2 mock Rulebook chunks with full metadata.

### claudeClient.js — mock response
When `MOCK_CLAUDE=true`, skip Claude API and return hardcoded JSON:
- vectorSimilarity ≥ 0.8 → `#Quotation_Request`, llm_self_score: 0.90
- 0.6–0.79 → `#Purchase_Intent`, llm_self_score: 0.68
- < 0.6 → tag: null, llm_self_score: 0.25, missing_information filled

### TaggingLog.js — in-memory
When `MOCK_MODE=true`, push to `global.__mockLogs[]` instead of PostgreSQL.

### webhook.js — signature bypass
When `MOCK_MODE=true`, skip HMAC-SHA256 LINE signature verification.

## Demo Script (scripts/demo.js)

Fires 3 HTTP POST requests to `POST /webhook` sequentially, pretty-prints results.

| Scenario | Message | Expected outcome |
|---|---|---|
| HIGH | "อยากได้ใบเสนอราคา 5 ชิ้นครับ" | tag: #Quotation_Request, confidence: ~0.91 |
| MEDIUM | "กำลังพิจารณาสินค้าอยู่ ยังไม่แน่ใจ" | tag: #Purchase_Intent, spot-check flag |
| LOW | "หมูกรอบอร่อยมาก 5555" | refuse, escalate to supervisor |

## Environment (.env for demo)

```env
MOCK_MODE=true
MOCK_CLAUDE=true
LINE_CHANNEL_SECRET=demo-secret
JWT_SECRET=demo-jwt-secret-for-local-testing-only
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## Out of Scope

- Real LINE OA integration
- Real Claude API calls
- PostgreSQL / Redis / Vector DB
- JWT enforcement (demo bypasses auth for simplicity)
