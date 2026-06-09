# smileChatBot — Pilot Guide

> สำหรับทีม Pilot 4–8 สัปดาห์แรก | Version: 1.0 | Date: 2026-06-09

---

## 1. Pilot Scope

| Item | ค่า |
|---|---|
| ระยะเวลา | 4–8 สัปดาห์ |
| จำนวน Agent | TBD (แนะนำ 3–5 คนสำหรับ Phase 1) |
| Volume แชทต่อวัน | TBD |
| Channel | LINE OA เท่านั้น (v1.0) |
| Human Review | Manual Spreadsheet (Dashboard UI post-pilot) |

---

## 2. Pre-Pilot Checklist

ก่อน Go-live ต้องผ่านทุกข้อนี้:

### Must-Have (บล็อก Go-live ถ้าไม่พร้อม)

- [ ] **Output Schema + JSON Validator** — unit tests ผ่านทั้งหมด
- [ ] **Webhook Server** — HTTPS, signature verify, async flow, response < 3s
- [ ] **Vector DB** — Rulebook chunks ingested พร้อม metadata ครบ
- [ ] **JWT Middleware** — silent block ทำงานถูกต้อง, role-based access ผ่าน
- [ ] **Confidence Engine** — threshold 0.6 ทำงานถูกต้อง, refusal logic ผ่าน test
- [ ] **Audit Logs** — tagging_log, refusal_log, correction_log ทำงาน

### Interim (ใช้แทนของจริงช่วง Pilot)

- [x] **Human Review** — Google Sheets สำหรับ manual correction (แทน Dashboard)

---

## 3. Rulebook Ingestion

ก่อน go-live ต้อง ingest Rulebook ลง Vector DB:

```bash
# 1. วาง Rulebook PDF ใน ./data/
cp /path/to/tagging-rulebook-v3.pdf ./data/

# 2. Run ingestion script
npm run ingest:rulebook -- \
  --file ./data/tagging-rulebook-v3.pdf \
  --version v3.0 \
  --effective-date 2026-01-01 \
  --scope general

# 3. ตรวจสอบว่า chunks ถูก ingest ครบ
# ควรเห็น log: "Ingested N chunks from tagging-rulebook-v3"
```

**Metadata ที่ต้องมีทุก chunk:**

| Field | Required | Example |
|---|---|---|
| `document_id` | ✅ | `tagging-rulebook-v3` |
| `version` | ✅ | `3.0` |
| `section_id` | ✅ | `2.3` |
| `effective_date` | ✅ | `2026-01-01` |
| `active_status` | ✅ | `true` |
| `scope` | ✅ | `general` / `partner` |
| `access_level` | ✅ | `agent` / `supervisor` / `admin` |

---

## 4. Agent Onboarding

### สิ่งที่ Agent จะเห็น

เมื่อลูกค้าส่งข้อความมาใน LINE OA ระบบจะ:

1. วิเคราะห์ข้อความภายใน ~10 วินาที
2. ส่ง notification ไปยัง Dashboard (ชั่วคราว: อัปเดต Google Sheet)
3. แสดงผลในรูปแบบ:

```
📋 Case: LINE-XXXXXX
🏷️ Tag: #Quotation_Request  
📖 อ้างอิง: Corporate Tagging Rulebook v3.0 §2.3
🎯 Confidence: High (0.85)
✅ Action: Tagged
```

### เมื่อระบบ Refuse

ถ้าระบบ confidence < 0.6:

```
⚠️ Case: LINE-XXXXXX
🤔 ระบบไม่มั่นใจพอ — ต้องการการตรวจสอบจากมนุษย์
💡 AI แนะนำ: #General_Inquiry (confidence: 0.45)
📝 ขาดข้อมูล: ข้อความกำกวม ไม่ระบุสินค้าที่ต้องการ
👤 กรุณาตรวจสอบและติด Tag ด้วยตนเอง
```

---

## 5. Human Review Process (Pilot)

ใช้ Google Sheet ชั่วคราวตาม template นี้:

| Timestamp | Case ID | AI Tag | AI Confidence | Human Tag | Correct? | Correction Reason | Reviewed By |
|---|---|---|---|---|---|---|---|
| 2026-06-09 10:00 | LINE-4591 | #Quotation_Request | 0.85 | #Quotation_Request | ✅ | — | admin_001 |
| 2026-06-09 10:05 | LINE-4592 | #General_Inquiry | 0.45 | #Quotation_Request | ❌ | ลูกค้าระบุราคาชัดเจนในประโยคที่ 3 | admin_001 |

**Spot-check ทุกวัน:** สุ่มตรวจ 10% ของ cases ทั้งหมด

---

## 6. KPIs ที่ต้องวัด

วัดทุกสัปดาห์ตลอด Pilot:

| Metric | Target | วิธีวัด |
|---|---|---|
| Tagging Accuracy | ≥ 85% | Human spot-check 10% ของ cases |
| Evidence Coverage | 100% | ทุก AI tag ต้องมี source_evidence |
| Refusal Precision | ≥ 90% | Correct refusal สำหรับ ambiguous cases |
| Webhook Response Time | < 3s | LINE platform logs |
| False Positive Rate | < 10% | Human correction log |

---

## 7. Open Questions ที่ต้องตัดสินใจก่อน Go-live

| # | คำถาม | ผู้ตัดสินใจ | Deadline |
|---|---|---|---|
| 1 | Embedding model: Thai-specific หรือ `text-embedding-3-large`? | AI Engineer | ก่อน Vector DB setup |
| 2 | Confidence threshold 0.6 เหมาะสมไหม? | PO + AI Engineer | หลัง Week 2 |
| 3 | Rulebook chunking: Fixed-size (512 tokens) หรือ Semantic by section? | AI Engineer | ก่อน Ingestion |
| 4 | Dashboard: Google Sheet / Retool / Notion? | Admin Lead | ก่อน Go-live |
| 5 | Pilot เริ่มกับ Agent กี่คน? Volume แชทต่อวันเท่าไหร่? | PO | ก่อน Go-live |

---

## 8. Escalation & Support

| ปัญหา | ติดต่อ |
|---|---|
| ระบบล่ม / Webhook ไม่รับ | DevOps (Slack #ops-alerts) |
| Tag ผิดบ่อย / Confidence สูงเกินไป | AI Engineer |
| Agent เข้าไม่ได้ / Permission ผิด | Security Team |
| Rulebook ต้องอัปเดต | Data GOV |
| PDPA / ข้อมูลส่วนตัวรั่ว | Compliance + Security (immediate) |

---

*smileFOKUS Group 3 | Pilot Guide v1.0 | 2026-06-09*
