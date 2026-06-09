# smileChatBot 🤖

> **Evidence-Gated, Automated Journey Tagging Engine**  
> ระบบ AI วิเคราะห์และติดแท็กเจตนาลูกค้าอัตโนมัติจากแชท LINE OA โดยอ้างอิงหลักฐานจาก Rulebook เสมอ

**Version:** 1.0 | **Date:** 2026-06-09 | **Owner:** smileFOKUS Group 3

---

## 📋 สารบัญ

- [Overview](#overview)
- [หลักการสำคัญ 3 ข้อ](#หลักการสำคัญ-3-ข้อ)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Output Schema](#output-schema)
- [Confidence Logic](#confidence-logic)
- [Pilot Readiness](#pilot-readiness)

---

## Overview

smileChatBot ทำหน้าที่เป็น **Gatekeeper** คัดกรองข้อความแชทจากลูกค้า แล้ววิเคราะห์ "เจตนาที่แท้จริง" เพื่อติด Tag Status (เช่น `#Quotation_Request`, `#Bug_Report`) โดยอ้างอิงจาก Corporate Tagging Rulebook เสมอ

ระบบนี้**ไม่ได้แทนที่คน** แต่มาช่วยเป็น Gatekeeper คัดกรองข้อมูลดิบให้กลายเป็นสถิติที่สะอาด ตรวจสอบได้ และปลอดภัยตาม PDPA

---

## หลักการสำคัญ 3 ข้อ

| # | หลักการ | รายละเอียด |
|---|---|---|
| 1 | **Evidence-Based** | ทุกแท็กต้องอ้างอิง Rulebook `section` + `version` เสมอ — ห้าม hallucinate |
| 2 | **Zero-Trust Refusal** | confidence < 0.6 → ปฏิเสธการเดา → ส่งให้ human-in-the-loop |
| 3 | **Access-Controlled** | ทุก retrieval ผ่าน JWT middleware ก่อนเสมอ ไม่มีข้อยกเว้น |

---

## Architecture

```
LINE OA (Customer)
      │
      ▼
[LINE Webhook] ──→ HTTP 200 (immediate ≤3s)
      │
      ▼ (async)
[Webhook Server — Node.js/Express]
      │
      ├─→ [JWT Middleware]          ── verify user_id + role + assigned_cases
      │
      ├─→ [Retrieval Layer / RAG]
      │       ├─ filter: active_status=true + MAX(effective_date)
      │       ├─ filter: scope by JWT.team (partner > general)
      │       └─ semantic search → Vector DB (Rulebook chunks)
      │
      ├─→ [Claude API]              ── Structured JSON Output only
      │
      ├─→ [Confidence Engine]
      │       └─ weighted_final = f(vector_similarity, llm_self_score)
      │
      ├─→ [Validation Layer]
      │       ├─ score ≥ 0.6 → tag → push to Dashboard
      │       └─ score < 0.6 → refuse → escalate to human
      │
      └─→ [CRM / Agent Dashboard]
              ├─ Tag + Evidence display
              ├─ Clarification card (ambiguous cases)
              └─ Correction interface (human review)
```

### Tech Stack

| Layer | Technology | หมายเหตุ |
|---|---|---|
| Backend | Node.js + Express | แนะนำ Fastify ถ้า throughput สูง |
| LINE SDK | `@line/bot-sdk` | signature verification built-in |
| AI Model | Claude API (`claude-sonnet-4-20250514`) | structured JSON output |
| Vector DB | pgvector / Chroma / Pinecone | เลือกตาม infra ที่มี |
| Database | PostgreSQL | chat logs, tagging history |
| Cache / Queue | Redis | session + queue management |
| Auth | JWT (`jsonwebtoken`) | roles: admin / supervisor / agent |
| Hosting | AWS EB / Railway / Render | ต้องเป็น HTTPS เท่านั้น |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- Redis ≥ 7
- Vector DB (เลือกตาม infra)
- LINE Messaging API Channel (HTTPS webhook URL)

### Installation

```bash
# 1. Clone & install
git clone <repo-url>
cd smileChatBot
npm install

# 2. ตั้งค่า environment
cp .env.example .env
# แก้ไขค่าใน .env ให้ครบถ้วน

# 3. ตั้งค่า database
npm run db:migrate

# 4. Ingest Rulebook ลง Vector DB
npm run ingest:rulebook -- --file ./data/tagging-rulebook-v3.pdf

# 5. Start server
npm run dev        # development (port 3000)
npm run start      # production
```

### Local Development (Ngrok)

```bash
# terminal 1 — start server
npm run dev

# terminal 2 — expose local port
ngrok http 3000

# คัดลอก HTTPS URL จาก ngrok แล้ว set ใน LINE Developers Console
# ⚠️ URL เปลี่ยนทุกครั้งที่ restart ngrok (free tier)
```

---

## Project Structure

```
smileChatBot/
├── src/
│   ├── middleware/
│   │   ├── jwtAuth.js          # JWT verification + role check
│   │   └── lineSignature.js    # LINE webhook signature verify
│   ├── retrieval/
│   │   ├── vectorSearch.js     # semantic search + metadata filter
│   │   ├── documentFilter.js   # version/scope/access filters
│   │   └── ambiguityResolver.js# ตรวจ duplicate case/customer
│   ├── ai/
│   │   ├── claudeClient.js     # Claude API wrapper
│   │   ├── systemPrompt.js     # system prompt + few-shot examples
│   │   └── outputParser.js     # parse + validate JSON response
│   ├── validation/
│   │   ├── confidenceEngine.js # weighted_final score calculation
│   │   ├── schemaValidator.js  # JSON schema validation
│   │   └── refusalLogic.js     # refuse / escalate decision
│   ├── routes/
│   │   ├── webhook.js          # POST /webhook — LINE events
│   │   └── health.js           # GET /health — health check
│   ├── models/
│   │   ├── TaggingLog.js       # tagging result log
│   │   ├── RefusalLog.js       # refusal event log
│   │   └── CorrectionLog.js    # human correction log
│   └── app.js                  # Express app setup
├── scripts/
│   ├── ingestRulebook.js       # Rulebook → Vector DB ingestion
│   └── dbMigrate.js            # Database migration
├── tests/
│   ├── schema.test.js          # Output schema validation tests
│   ├── confidence.test.js      # Confidence engine tests
│   └── retrieval.test.js       # Retrieval layer tests
├── docs/
│   ├── ARCHITECTURE.md         # Detailed architecture doc
│   ├── API_REFERENCE.md        # API endpoint documentation
│   ├── RUNBOOK.md              # Operations runbook
│   └── PILOT_GUIDE.md         # Pilot onboarding guide
├── .env.example                # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## Environment Variables

```bash
# สร้าง .env จาก template
cp .env.example .env
```

ดูรายละเอียดทั้งหมดใน [`.env.example`](.env.example)

| Variable | Required | Description |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | LINE channel access token |
| `LINE_CHANNEL_SECRET` | ✅ | LINE channel secret (signature verify) |
| `JWT_SECRET` | ✅ | Secret สำหรับ sign/verify JWT |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `VECTOR_DB_URL` | ✅ | Vector DB endpoint |
| `VECTOR_DB_API_KEY` | ✅ | Vector DB API key |
| `CONFIDENCE_THRESHOLD` | ⚙️ | ค่า default = `0.6` |
| `PORT` | ⚙️ | ค่า default = `3000` |

> ❌ **ห้าม hardcode** ค่าใดๆ ใน source code — ใช้ `.env` เท่านั้น

---

## API Reference

### `POST /webhook`

LINE Messaging API webhook endpoint

- ตอบ `HTTP 200` ทันทีภายใน 3 วินาที
- ประมวลผล async หลังตอบกลับ LINE แล้ว
- ต้อง verify `x-line-signature` header ทุก request

### `GET /health`

Health check endpoint สำหรับ load balancer / monitoring

```json
{
  "status": "ok",
  "timestamp": "2026-06-09T10:00:00Z",
  "version": "1.0.0"
}
```

ดูรายละเอียดเพิ่มเติมใน [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

---

## Output Schema

ทุก AI response ต้องอยู่ในรูปแบบนี้เท่านั้น:

```json
{
  "answer_summary": {
    "tag": "#Quotation_Request",
    "description": "ลูกค้าต้องการขอราคาสินค้า"
  },
  "source_evidence": {
    "document": "Corporate Tagging Rulebook",
    "version": "v3.0",
    "section": "2.3",
    "effective_date": "2026-01-01"
  },
  "confidence_signal": {
    "vector_similarity": 0.87,
    "llm_self_score": 0.82,
    "weighted_final": 0.85,
    "level": "high"
  },
  "missing_information": null,
  "recommended_action": "tag",
  "review_owner": "admin"
}
```

### Enum Values

| Field | Allowed Values |
|---|---|
| `recommended_action` | `tag` / `ask_clarification` / `escalate` / `refuse` |
| `review_owner` | `admin` / `supervisor` |
| `confidence_signal.level` | `high` / `medium` / `low` |

---

## Confidence Logic

| `weighted_final` | Level | Action |
|---|---|---|
| ≥ 0.8 | `high` | Tag อัตโนมัติ |
| 0.6 – 0.79 | `medium` | Tag + Flag for spot-check |
| < 0.6 | `low` | **Refuse** → Escalate to human |

```
weighted_final = (vector_similarity × 0.5) + (llm_self_score × 0.5)
```

> ⚙️ น้ำหนักสามารถปรับได้ใน `src/validation/confidenceEngine.js`

---

## Pilot Readiness

| # | Item | Priority | Status |
|---|---|---|---|
| 1 | Output Schema + JSON Validator + Unit Tests | **Must-have before go** | ⏳ Pending |
| 2 | Webhook Server + Async Flow + HTTPS | **Must-have before go** | ⏳ Pending |
| 3 | Vector DB + Rulebook Chunks + Metadata | **Must-have before go** | ⏳ Pending |
| 4 | JWT Middleware + Access Control (Silent Block) | **Must-have before go** | ⏳ Pending |
| 5 | Human Review (Manual Spreadsheet — Interim) | **Must-have before go** | ✅ Ready |
| 6 | Agent Dashboard UI | Post-Pilot | — |
| 7 | Improvement Loop / Few-shot Training | Post-Pilot | — |

---

## Contributing & Review

- ทุก PR ต้องผ่าน code review จาก AI Engineer อย่างน้อย 1 คน
- Unit test coverage ≥ 80% สำหรับ `validation/` และ `retrieval/` layer
- ห้าม merge ถ้า schema validator test fail

---

## References

- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Bot SDK Node.js](https://github.com/line/line-bot-sdk-nodejs)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Claude API Docs](https://docs.anthropic.com)
- Corporate Tagging Rulebook v3.0 (internal)
- Software Architecture Design Document Section 4.5 (internal)

---

*Generated from smileFOKUS Workshop — Group 3 | Version: 1.0 | Date: 2026-06-09*
