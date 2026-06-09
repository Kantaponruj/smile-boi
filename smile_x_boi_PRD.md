# PRD — smileChatBot
**Evidence-Gated, Automated Journey Tagging Engine**

> Version: 1.0 | Date: 2026-06-09 | Owner: smileFOKUS Group 3

---

## 1. Executive Summary

smileChatBot คือระบบ AI ที่ทำหน้าที่วิเคราะห์และติดแท็กเจตนาของลูกค้า (Customer Intent Tagging) จากข้อความแชทใน LINE OA โดยอัตโนมัติ โดยยึดหลักการ **"ไม่ตอบถ้าไม่มีหลักฐาน"** ทุกการติดแท็กต้องอ้างอิงจาก Corporate Tagging Rulebook เสมอ และมีระบบ Human-in-the-Loop รองรับกรณีที่ความมั่นใจต่ำกว่าเกณฑ์

ระบบนี้ไม่ได้มาแทนที่เจ้าหน้าที่ แต่มาเป็น **Gatekeeper** คัดกรองข้อมูลดิบให้กลายเป็นสถิติที่สะอาด ตรวจสอบได้ และปลอดภัยตาม PDPA

---

## 2. Problem Statement

### ปัญหาปัจจุบัน

| ปัญหา | ผลกระทบ |
|---|---|
| เจ้าหน้าที่ติดแท็กด้วยมือ ทำให้เกิด Human Error | ข้อมูลใน CRM ไม่ตรงกัน ทำนายยอดขายไม่แม่น |
| ไม่มีมาตรฐานกลาง — แต่ละคนตีความต่างกัน | แท็กซ้ำกัน หรือแท็กผิดหมวด |
| ไม่มี Audit Trail — ตรวจสอบย้อนหลังไม่ได้ | ไม่สามารถวัด KPI การจัดการเคสได้ |
| AI ทั่วไป Hallucinate คำตอบเอง | ข้อมูลผิดพลาดเข้า CRM โดยไม่รู้ตัว |
| ข้อมูลดิบเข้าถึงได้โดยไม่มีการกรอง PDPA | ความเสี่ยงด้าน Compliance |

---

## 3. Goals & Success Metrics

### Goals (ระยะ Pilot 4–8 สัปดาห์)

- ลด Human Tagging Error ลงได้ ≥ 50% เทียบกับก่อน Pilot
- ทุกแท็กที่ระบบ AI สร้างต้องมี Evidence อ้างอิงได้ 100%
- ระบบ Refusal Logic ทำงานถูกต้องสำหรับ Confidence < 0.6

### KPIs

| Metric | Target | วิธีวัด |
|---|---|---|
| Tagging Accuracy | ≥ 85% | Human spot-check 10% of cases |
| Evidence Coverage | 100% | All AI tags must have source_evidence |
| Refusal Precision | ≥ 90% | Correct refusal for ambiguous cases |
| Webhook Response Time | < 3 วินาที | LINE platform SLA |
| False Positive Rate | < 10% | Human correction log |

---

## 4. User Stories & Personas

### Personas

| Persona | Role | ความต้องการหลัก |
|---|---|---|
| **แอดมินตอบแชท** | Agent | เห็นแท็กที่แนะนำพร้อม Evidence อ้างอิงทันที |
| **Supervisor** | Team Lead | ตรวจ Spot-check และ Override แท็กที่ผิด |
| **Sales Team** | Sales | กรองเคส #Quotation_Request ได้เร็วขึ้น |
| **AI Engineer** | Dev | ปรับ Prompt, Rulebook Chunk, Confidence Threshold |
| **Data GOV / Compliance** | Governance | ตรวจสอบ Access Log และ PDPA compliance |

### User Stories หลัก

**US-01** — แอดมินดูเจตนาลูกค้า
> "ในฐานะ Agent ฉันต้องการเห็นแท็กเจตนาของลูกค้าพร้อม Rulebook อ้างอิงทันที เพื่อที่ฉันจะได้ตอบสนองได้อย่างถูกต้องและรวดเร็ว"

**US-02** — ระบบปฏิเสธเมื่อไม่แน่ใจ
> "ในฐานะ Supervisor ฉันต้องการให้ระบบส่งเคสที่กำกวมมาให้ฉันตัดสินใจ ไม่ใช่ให้ AI เดาเอง เพราะข้อมูลผิดใน CRM แก้ยาก"

**US-03** — ป้องกันการเข้าถึงข้อมูลเกิน Role
> "ในฐานะ Agent ฉันควรเห็นเฉพาะเคสที่ถูก Assign ให้ฉัน ไม่ใช่ Raw Chat ที่ยังไม่กรอง PDPA ของลูกค้าคนอื่น"

**US-04** — ระบบดึง Rulebook เวอร์ชันล่าสุดเสมอ
> "ในฐานะ PO ฉันต้องการให้ระบบเลือกใช้ Rulebook ที่ Effective อยู่เสมอ ไม่ใช่เวอร์ชันเก่า"

---

## 5. Functional Requirements

### FR-01: Webhook & Message Processing

- รับ Webhook Event จาก LINE OA และตอบกลับ HTTP 200 ภายใน **3 วินาที**
- ประมวลผล Message Event แบบ **Async** ไม่บล็อก Response
- Verify LINE Signature (`x-line-signature`) ทุก Request โดยไม่มีข้อยกเว้น

### FR-02: JWT Authentication & Access Control

- ทุก Retrieval Request ต้องผ่าน JWT Middleware ก่อน
- JWT Payload ต้องมี: `user_id`, `role`, `team`, `assigned_cases`
- Agent เห็นได้เฉพาะ Case ที่ถูก Assign (`assigned_cases`)
- การปฏิเสธ Access ให้ return `404 Not Found` (Silent Block) ไม่ใช่ `403 Forbidden`

### FR-03: Retrieval Layer (RAG)

- ดึงเฉพาะ Document ที่ `active_status = true` และ `effective_date` ล่าสุดเท่านั้น
- Scope Priority: Partner Rule > General Rule (ถ้า JWT.team = "partner")
- Chunk Metadata ที่ต้องมีทุกชิ้น: `document_id`, `version`, `section_id`, `effective_date`, `active_status`, `scope`, `access_level`
- กรณี Ambiguous (ชื่อซ้ำ) ให้ return `ask_clarification` พร้อมตัวเลือก Structured (ไม่ใช่ Free-text)

### FR-04: AI Analysis (Claude API)

- Input: Chat Message + Retrieved Rulebook Sections
- Output: Structured JSON ตาม Output Schema (ส่วนที่ 6) เท่านั้น
- ห้าม Free-text Response โดยไม่มี Schema

### FR-05: Confidence Engine

- คำนวณ `weighted_final` จาก Vector Similarity Score + LLM Self-assessed Score
- Confidence ≥ 0.8 → Tag อัตโนมัติ
- Confidence 0.6–0.79 → Tag พร้อม Flag Spot-check
- Confidence < 0.6 → **Refuse** และ Escalate ไปยัง Human-in-the-Loop

### FR-06: Refusal & Escalation Logic

- กรณี Confidence < 0.6: ไม่เขียน Tag ลง CRM, ส่ง Clarification Card ไปยัง Agent Dashboard
- กรณี Ambiguous Case: ส่ง Structured Choice Card (ไม่ใช่ Free-text) ให้ Agent เลือก
- Log ทุก Refusal Event: `{ case_id, ai_suggestion, refusal_reason, timestamp }`

### FR-07: Human Review & Correction Loop

- Agent/Supervisor สามารถ Override Tag ได้จาก Dashboard
- ทุก Correction ต้องมี Log: `ai_suggested_tag`, `human_corrected_tag`, `corrected_by`, `correction_reason`
- รวบรวม Correction Log หลัง Pilot เพื่อนำไปสร้าง Few-shot Examples

---

## 6. Output Schema (JSON)

ทุก AI Response ต้องอยู่ในรูปแบบนี้เท่านั้น:

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

### Validation Rules

| Field | Required | Rule | Fallback |
|---|---|---|---|
| `answer_summary` | Yes | ต้องสอดคล้องกับ Rulebook เล่มล่าสุด | Refuse → แจ้ง "ไม่พบข้อมูลที่เพียงพอ" |
| `source_evidence` | Yes | ตรวจสอบสิทธิ์ + เลข Version ที่ Active | Retry สูงสุด 3 ครั้ง |
| `confidence_signal` | Yes | weighted_final ≥ 0.6 ถึงจะ Tag ได้ | Escalate to Human |
| `missing_information` | Conditional | ต้องไม่ว่างถ้า Confidence = Low | ถามลูกค้า/Admin เพิ่ม |
| `recommended_action` | Yes | ต้องสอดคล้องกับ Agent Role และ Policy | Escalate to Supervisor |
| `review_owner` | Yes | ตรวจสอบสิทธิ์ตามโครงสร้างองค์กร | Refuse → ไม่อนุญาตให้เข้าถึง |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Webhook response < 3s, AI analysis < 10s end-to-end |
| **Security** | HTTPS required, JWT สำหรับทุก Request, Silent Block สำหรับ Unauthorized Access |
| **PDPA Compliance** | Raw Chat Log ต้องผ่าน PII Masking ก่อนแสดงผล |
| **Availability** | Uptime ≥ 99% ในช่วง Business Hours |
| **Auditability** | Log ทุก Retrieval, Tagging, Refusal, Correction Event |
| **Scalability** | รองรับ Redis Queue สำหรับ Peak Traffic |
| **Versioning** | ต้องรองรับ Rulebook หลาย Version (ดึงแค่ Active ล่าสุด) |

---

## 8. System Architecture

```
LINE OA (Customer)
      │
      ▼
[LINE Webhook] ──→ HTTP 200 (immediate)
      │
      ▼ (async)
[Webhook Server — Node.js/Express]
      │
      ├─→ [JWT Middleware] ── verify user_id + role
      │
      ├─→ [Retrieval Layer / Vector DB]
      │       ├─ filter: active_status=true + effective_date MAX
      │       ├─ filter: scope by JWT.team
      │       └─ semantic search → Rulebook chunks
      │
      ├─→ [Claude API — Structured JSON Output]
      │
      ├─→ [Confidence Engine]
      │       └─ weighted_final = f(vector_similarity, llm_self_score)
      │
      ├─→ [Validation Layer]
      │       ├─ score ≥ 0.6 → tag → push to Dashboard
      │       └─ score < 0.6 → refuse → escalate
      │
      └─→ [CRM / Agent Dashboard]
              ├─ Tag + Evidence display
              ├─ Clarification card (ambiguous)
              └─ Correction interface (human review)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (แนะนำ Fastify ถ้า Throughput สูง) |
| LINE SDK | `@line/bot-sdk` |
| AI Model | Claude API (`claude-sonnet-4`) |
| Vector DB | pgvector / Chroma / Pinecone |
| Database | PostgreSQL |
| Cache / Queue | Redis |
| Auth | JWT (`jsonwebtoken`) |
| Hosting | AWS EB / Railway / Render (ต้องเป็น HTTPS) |

---

## 9. Out of Scope (v1.0)

- การรองรับ Channel อื่นนอกจาก LINE OA (เช่น Facebook Messenger, WhatsApp)
- Multi-language Support (นอกจากภาษาไทย)
- Agent Dashboard UI (Post-Pilot — ใช้ Manual Spreadsheet ชั่วคราว)
- Automatic Rulebook Ingestion Pipeline
- Real-time Analytics Dashboard

---

## 10. Pilot Readiness Checklist

| # | Item | Priority | Status |
|---|---|---|---|
| 1 | Output Schema + JSON Validator + Unit Tests | **Must-have before go** | Pending |
| 2 | Webhook Server + Async Flow + HTTPS | **Must-have before go** | Pending |
| 3 | Vector DB + Rulebook Chunks + Metadata | **Must-have before go** | Pending |
| 4 | JWT Middleware + Access Control (Silent Block) | **Must-have before go** | Pending |
| 5 | Human Review (Manual Spreadsheet — Interim) | **Must-have before go** | Ready |
| 6 | Agent Dashboard UI | Post-Pilot | — |
| 7 | Improvement Loop / Few-shot Training | Post-Pilot | — |

---

## 11. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rulebook ไม่ได้อัปเดตตาม Policy ใหม่ | Medium | High | Review Rulebook ทุก Quarter |
| Confidence Threshold ตั้งไว้ต่ำเกินไป → AI Tag ผิด | Medium | High | Spot-check 10% หลัง Pilot 2 สัปดาห์ |
| Vector DB Embedding ไม่ตรงกับ Query ภาษาไทย | High | Medium | ทดสอบ Embedding Model ก่อน Go-live |
| LINE Rate Limit ในช่วง Peak Traffic | Low | Medium | Redis Queue + Fallback per Architecture Section 4.5 |
| PDPA Breach จาก Raw Log Exposure | Low | Critical | Silent Block + PII Masking + Audit Log |

---

## 12. Open Questions

1. **Embedding Model**: ใช้ Model ภาษาไทยเฉพาะทาง หรือ Multilingual (เช่น `text-embedding-3-large`)?
2. **Confidence Threshold**: 0.6 เหมาะกับ Business Case นี้หรือไม่? อาจต้องปรับหลัง Pilot
3. **Rulebook Chunking Strategy**: ใช้ Fixed-size Chunk หรือ Semantic Chunk ตาม Section?
4. **Dashboard Tool**: ใช้ Retool / Notion / Custom UI สำหรับ Human Review ช่วง Pilot?
5. **Pilot Scope**: เริ่มกับ Agent กี่คน และ Volume แชทต่อวันเท่าไหร่?

---

## 13. References

- LINE Messaging API: https://developers.line.biz/en/docs/messaging-api/
- LINE Bot SDK Node.js: https://github.com/line/line-bot-sdk-nodejs
- Claude API Docs: https://docs.anthropic.com
- Corporate Tagging Rulebook v3.0 (Internal)
- Software Architecture Design Document Section 4.5 (Internal)
- smileChatBot Dev Spec v1.0 (Internal)

---

*PRD generated from smileFOKUS Workshop outputs — Group 3*
*Version: 1.0 | Date: 2026-06-09 | Status: Draft for Review*
