# smileChatBot — Architecture Document

> Version: 1.0 | Date: 2026-06-09

---

## 1. System Overview

smileChatBot เป็นระบบ **Evidence-Gated AI Tagging Engine** ที่รับข้อความจาก LINE OA แล้ววิเคราะห์เจตนาลูกค้าโดย:

1. ดึง context จาก Vector DB (Rulebook chunks) ด้วย RAG
2. ส่ง context + ข้อความไปให้ Claude API วิเคราะห์
3. ตรวจสอบ confidence score ก่อนตัดสินใจ tag หรือ escalate
4. บันทึก audit log ทุก event

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LINE Platform                           │
│                    (Customer sends message)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /webhook
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Webhook Server                             │
│                   (Node.js + Express)                           │
│                                                                 │
│  1. Verify x-line-signature (HMAC-SHA256)                       │
│  2. Return HTTP 200 immediately (≤ 3 seconds)                   │
│  3. Hand off to async processMessage()                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ async
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      JWT Middleware                             │
│                                                                 │
│  • Verify JWT token                                             │
│  • Extract: user_id, role, team, assigned_cases                 │
│  • Silent Block: unauthorized → 404 (not 403)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────┐   ┌──────────────────────────┐
│   Retrieval Layer     │   │    Redis Queue / Cache   │
│                       │   │                          │
│ 1. Filter by:         │   │  • Peak traffic buffer   │
│    - active_status    │   │  • Session state         │
│    - effective_date   │   │  • Rate limit handling   │
│    - scope (JWT.team) │   └──────────────────────────┘
│    - access_level     │
│ 2. Semantic search    │
│    → Vector DB        │
│ 3. Return top-k chunks│
└───────────┬───────────┘
            │ Rulebook chunks + metadata
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Claude API Layer                             │
│                                                                 │
│  Input:  chat_message + rulebook_sections + system_prompt       │
│  Output: Structured JSON (Output Schema only — no free-text)    │
│  Model:  claude-sonnet-4-20250514                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Confidence Engine                             │
│                                                                 │
│  vector_similarity  (from retrieval step)                       │
│  llm_self_score     (from Claude self-assessment)               │
│  weighted_final  =  (vec × 0.5) + (llm × 0.5)                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
        ≥ 0.8       0.6–0.79       < 0.6
          │             │             │
        TAG           TAG +        REFUSE
      (auto)        SPOT FLAG    → ESCALATE
          │             │             │
          └──────────┬──┘             │
                     ▼               ▼
          ┌──────────────────┐  ┌────────────────┐
          │  CRM / Dashboard │  │  Clarification │
          │  • Tag + Evidence│  │  Card to Agent │
          │  • Audit log     │  │  + Refusal Log │
          └──────────────────┘  └────────────────┘
```

---

## 3. Data Flow — Detailed

### 3.1 Normal Case (High Confidence)

```
Customer → LINE → Webhook → JWT Check → Retrieve Rulebook Chunks
→ Claude API → JSON Output → Confidence ≥ 0.8
→ Write Tag to CRM → Push notification to Agent Dashboard
→ Log: { case_id, tag, evidence, confidence, timestamp }
```

### 3.2 Low Confidence Case

```
Customer → LINE → Webhook → JWT Check → Retrieve Rulebook Chunks
→ Claude API → JSON Output → Confidence < 0.6
→ DO NOT write tag → Send Clarification Card to Agent
→ Log: { case_id, ai_suggestion, refusal_reason, timestamp }
→ Agent reviews → Manual tag → Correction Log
```

### 3.3 Ambiguous Case (Duplicate Customer Name)

```
Query → Retrieval → Multiple matching cases found
→ recommended_action = "ask_clarification"
→ Send Structured Choice Card (NOT free-text):
  [{ label: "Project A — case-001" }, { label: "Project B — case-002" }]
→ Agent selects → Resume with selected case_id
```

### 3.4 Access Boundary Case

```
Agent requests case NOT in assigned_cases
→ JWT Middleware → Silent Block
→ Return 404 Not Found (NOT 403 Forbidden)
→ Log unauthorized access attempt
→ DO NOT reveal that data exists
```

---

## 4. Database Schema

### 4.1 tagging_logs

```sql
CREATE TABLE tagging_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         VARCHAR(100) NOT NULL,
  chat_message    TEXT NOT NULL,
  suggested_tag   VARCHAR(100),
  evidence_doc    VARCHAR(200),
  evidence_version VARCHAR(20),
  evidence_section VARCHAR(50),
  confidence_vector FLOAT,
  confidence_llm    FLOAT,
  confidence_final  FLOAT,
  confidence_level  VARCHAR(10),  -- high / medium / low
  recommended_action VARCHAR(30),
  review_owner    VARCHAR(30),
  status          VARCHAR(30),    -- tagged / refused / escalated / corrected
  created_at      TIMESTAMP DEFAULT NOW(),
  agent_id        VARCHAR(100)
);
```

### 4.2 refusal_logs

```sql
CREATE TABLE refusal_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         VARCHAR(100) NOT NULL,
  ai_suggestion   VARCHAR(100),
  refusal_reason  TEXT,
  confidence_final FLOAT,
  escalated_to    VARCHAR(100),
  timestamp       TIMESTAMP DEFAULT NOW()
);
```

### 4.3 correction_logs

```sql
CREATE TABLE correction_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               VARCHAR(100) NOT NULL,
  tagging_log_id        UUID REFERENCES tagging_logs(id),
  ai_suggested_tag      VARCHAR(100),
  human_corrected_tag   VARCHAR(100),
  corrected_by          VARCHAR(100),
  correction_reason     TEXT,
  timestamp             TIMESTAMP DEFAULT NOW()
);
```

### 4.4 rulebook_chunks (Vector DB metadata mirror)

```sql
CREATE TABLE rulebook_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     VARCHAR(100) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  section_id      VARCHAR(50),
  effective_date  DATE NOT NULL,
  active_status   BOOLEAN DEFAULT TRUE,
  scope           VARCHAR(50),   -- general / partner
  access_level    VARCHAR(30),   -- agent / supervisor / admin
  content_preview TEXT,
  vector_id       VARCHAR(200),  -- reference to Vector DB
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Retrieval Layer — Filter Logic

```javascript
// Priority order for document retrieval
const retrievalFilters = {
  // Step 1: Always filter by active + latest version
  mandatory: {
    active_status: true,
    effective_date: 'MAX'  // only latest effective date
  },

  // Step 2: Scope based on JWT team
  scope: (jwtTeam) => {
    if (jwtTeam === 'partner') {
      return ['partner', 'general']  // partner first, fallback to general
    }
    return ['general']
  },

  // Step 3: Access level based on JWT role
  access: (jwtRole) => {
    const levelMap = { agent: 1, supervisor: 2, admin: 3 }
    return levelMap[jwtRole] || 1
  }
}
```

---

## 6. Conflict Resolution (Competing Sources)

เมื่อพบ 2 sources ขัดแย้งกัน (เช่น Partner SOP vs General Rulebook):

```
Priority Order:
1. Partner SOP (ถ้า JWT.team = 'partner')
2. General Rulebook
3. ถ้ายัง conflict → recommended_action = 'escalate'
   + log: { conflict_sources: [...], escalation_reason: 'conflicting_rules' }
```

---

## 7. Fallback & Queue (Peak Traffic)

อ้างอิงจาก Architecture Design Document Section 4.5:

```
Peak Traffic Flow:
LINE Webhook → Redis Queue (FIFO) → Worker Pool (N workers)
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                         Normal path          Rate limit hit
                              │                       │
                         Process msg           Queue with TTL
                                              Retry max 3x
                                              Alert if queue > threshold
```

**Redis Queue Key:** `smilechatbot:queue:pending`  
**Alert threshold:** Queue depth > 100 messages  
**TTL per message:** 300 seconds  

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
Client Request
  │
  ├── Header: Authorization: Bearer <JWT>
  │
  ▼
JWT Middleware
  ├── Verify signature (HS256, JWT_SECRET)
  ├── Check expiry
  ├── Extract payload: { user_id, role, team, assigned_cases }
  │
  └── Role-based access:
        agent     → เห็นเฉพาะ assigned_cases ตัวเอง
        supervisor → เห็น cases ทั้งทีม
        admin     → เห็นทั้งหมด (ยกเว้น raw PII)
```

### 8.2 PDPA Compliance

- Raw chat logs ต้องผ่าน PII Masking ก่อนแสดงผลทุกกรณี
- `user_id` จาก LINE จะถูก hash ก่อนเก็บใน log
- Access log บันทึกทุก retrieval event
- Data retention: chat logs เก็บ 90 วัน, tagging logs เก็บ 1 ปี

---

## 9. Monitoring & Alerting

| Metric | Alert Threshold | Channel |
|---|---|---|
| Webhook response time | > 2.5s | Slack #ops-alerts |
| Confidence refusal rate | > 30% in 1hr | Slack #ai-alerts |
| Queue depth | > 100 messages | PagerDuty |
| Vector DB latency | > 500ms p99 | Slack #ops-alerts |
| Error rate | > 1% in 5min | PagerDuty |

---

## 10. Open Architecture Questions

| # | Question | Priority |
|---|---|---|
| 1 | Embedding model: Thai-specific vs Multilingual (`text-embedding-3-large`)? | High |
| 2 | Confidence threshold 0.6 — ต้องปรับหลัง Pilot? | High |
| 3 | Rulebook chunking: Fixed-size vs Semantic (by section)? | Medium |
| 4 | Dashboard: Retool / Notion / Custom UI ช่วง Pilot? | Medium |
| 5 | pgvector vs Chroma vs Pinecone สำหรับ Thai text? | Medium |

---

*smileFOKUS Group 3 | Version: 1.0 | Date: 2026-06-09*
