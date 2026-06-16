# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server on :3000
npm test             # Run all tests (--runInBand, must be sequential)
npm run test:coverage  # Coverage — 70% branch/fn/line/statement threshold enforced
npm run db:seed      # Create tables + seed 11 rulebook chunks (requires DATABASE_URL in .env.local)
npm run build        # Production build
```

Run a single test file:
```bash
npx jest tests/retrieval/vectorSearch.test.js --runInBand
```

## Environment

Copy `.env.example` → `.env` for local dev. For DB mode, also populate `.env.local`.

| Variable | Default | Purpose |
|---|---|---|
| `MOCK_MODE` | `true` | `true` = in-memory store + keyword vector; `false` = Neon DB |
| `VERIFY_LINE_SIGNATURE` | unset | Set to `"true"` to verify `x-line-signature` headers |
| `LINE_CHANNEL_SECRET` | — | Required only when `VERIFY_LINE_SIGNATURE=true` |
| `DATABASE_URL` | — | Neon Postgres connection string (required when `MOCK_MODE=false`) |
| `CONFIDENCE_THRESHOLD` | `0.6` | Score below this → refuse + escalate |
| `CONFIDENCE_HIGH_THRESHOLD` | `0.8` | Score above this → high confidence tag |
| `CONFIDENCE_WEIGHT_VECTOR` | `0.5` | Weight for vector similarity in final score |
| `CONFIDENCE_WEIGHT_LLM` | `0.5` | Weight for LLM self-score in final score |

## Architecture

This is an **Evidence-Gated Customer Intent Tagging Engine** for LINE OA. Every tagged message must cite a Rulebook section; ambiguous messages are refused and escalated to a human.

### Request Flow

```
LINE Webhook POST /api/webhook
  └─ verifyLineSignature (if VERIFY_LINE_SIGNATURE=true)
  └─ processMessage (src/ai/claudeClient.js)
       ├─ retrieveRulebookChunks()   → keyword match → intent + vector score
       ├─ buildMockClaudeResponse()  → maps intent → tag, section, description
       ├─ calculateConfidence()      → weighted_final = 0.5·vector + 0.5·llm
       ├─ validateOutput()           → AJV schema check
       ├─ shouldEscalate()           → if level === 'low' → action = 'refuse'
       └─ logTagging() / logRefusal() → console only (TaggingLog.js is a stub)
  └─ appendLog()  → memory store OR Neon DB (logStore.js, dual-mode)

GET /api/admin  → getLogs() → feeds Admin Dashboard
```

### Dual-Mode Design

Almost every layer has a **mock / real** switch controlled by `MOCK_MODE`:

- **`src/retrieval/vectorSearch.js`** — mock: keyword matching against `INTENT_KEYWORDS`; real: Neon DB query on `rulebook_chunks` (no real embeddings yet — still uses keyword scoring on the DB rows)
- **`src/store/logStore.js`** — mock: capped in-process array (`memStore`, max 200); real: Neon `tagging_logs` table
- **`src/models/TaggingLog.js`** — currently a stub (console.log only); `logStore.js` is the actual persistence layer

### Confidence Levels & Actions

| `weighted_final` | Level | Action |
|---|---|---|
| ≥ 0.8 | `high` | `tag` |
| 0.6 – 0.79 | `medium` | `tag_with_flag` |
| < 0.6 | `low` | `refuse` → escalate to supervisor |

### Database Schema (Neon Postgres)

Two tables created by `npm run db:seed`:
- `rulebook_chunks` — 11 rows, `section_id` maps to Rulebook §X.X, has `embedding vector(1536)` column (unused until real embeddings are added)
- `tagging_logs` — append-only audit log; `appendLog()` writes here when `MOCK_MODE=false`

### Intent Tags (11 total)

Defined in `INTENT_KEYWORDS` (vectorSearch.js) and `INTENT_RESPONSE` (claudeClient.js), ordered by priority (first match wins):

`payment_confirmation` → `order_confirmation` → `quotation` → `complaint` → `payment` → `delivery_inquiry` → `promotion_inquiry` → `purchase_intent` → `product_inquiry` → `follow_up` → `general` (fallback, score 0.28)

### UI

- `app/page.jsx` — LINE-style chat demo (sends to webhook)
- `app/admin/page.jsx` — tagging log dashboard, polls `/api/admin` every 10s
- `app/globals.css` + Tailwind — dark theme throughout
- Fonts: **Figtree** (UI chrome/labels) + **Noto Sans Thai** (Thai content) + system `font-mono` (data values: scores, timestamps, case IDs)

## Design System

Design context is in [`.impeccable.md`](.impeccable.md). Key principles:

- **Admin palette**: flat `#0c0c0e` background, `#111114` surface — no gradients, no card shadows
- **Accent rule**: LINE green (`#06C755`) is for the chat interface only; admin uses neutral zinc + muted semantic colors (emerald/amber/rose)
- **Monospace for machine data only** — case IDs, scores, timestamps; never for Thai prose or labels
- **Borders**: 1px at `rgba(255,255,255,0.06–0.10)` opacity range — nothing heavier
