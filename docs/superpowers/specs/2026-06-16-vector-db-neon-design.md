# Design: Real Backend with Neon + pgvector

**Date:** 2026-06-16
**Status:** Approved
**Scope:** Replace mock in-memory storage with real Neon Postgres + pgvector for demo

---

## Goal

Make the smileChatBot backend "real" enough for a credible demo without spending money on AI API keys. The system will use real persistent storage (Neon DB), real data flow, and keyword-based similarity that can be upgraded to real vector embeddings later.

## What Changes

### Before

- `vectorSearch.js` — hardcoded `MOCK_CHUNKS` array, keyword similarity in-memory
- `logStore.js` — in-memory `memStore` array (lost on cold start) or Vercel KV
- LINE signature verification — skipped when `MOCK_MODE=true`

### After

- `vectorSearch.js` — queries `rulebook_chunks` table in Neon, runs keyword similarity against real DB rows
- `logStore.js` — inserts/queries `tagging_logs` table in Neon
- LINE signature — enforced when `MOCK_MODE=false` (env-controlled)

---

## Database Schema

### Table: `rulebook_chunks`

```sql
CREATE TABLE rulebook_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     TEXT NOT NULL,
  version         TEXT NOT NULL,
  section_id      TEXT NOT NULL,
  effective_date  DATE NOT NULL,
  active_status   BOOLEAN NOT NULL DEFAULT true,
  scope           TEXT NOT NULL DEFAULT 'general',  -- 'general' | 'partner'
  access_level    TEXT NOT NULL DEFAULT 'agent',
  content         TEXT NOT NULL,
  embedding       vector(1536)  -- NULL for demo; ready for real embeddings
);
```

Seed data: Corporate Tagging Rulebook v3.0 chunks (§1.0, §2.3, §3.1) — matches existing mock data.

### Table: `tagging_logs`

```sql
CREATE TABLE tagging_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              TEXT NOT NULL,
  tag                  TEXT,
  level                TEXT,
  score                FLOAT,
  action               TEXT,
  description          TEXT,
  message              TEXT,
  missing_information  TEXT,
  review_owner         TEXT,
  timestamp            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Retrieval Logic

### Current (mock)
```
detectMockSimilarity(query) → fixed score based on keyword list → return MOCK_CHUNKS
```

### New (real)
```
1. SELECT * FROM rulebook_chunks WHERE active_status=true ORDER BY effective_date DESC
2. For each chunk: score = keywordSimilarity(query, chunk.content)  ← same algorithm, real data
3. Sort by score DESC, return top N
4. vectorSimilarity = max(scores)
```

When real embeddings are added: replace step 2 with `<=> cosine_distance` operator via pgvector.

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `src/db/client.js` | Create | Neon postgres connection (pg pool) |
| `src/retrieval/vectorSearch.js` | Modify | Query DB instead of mock array |
| `src/store/logStore.js` | Modify | INSERT/SELECT from tagging_logs |
| `scripts/seed-db.js` | Create | Run once: CREATE tables + INSERT rulebook chunks |
| `app/api/admin/route.js` | Modify | Add DELETE by id endpoint |

---

## Environment Variables

```
DATABASE_URL=postgresql://...  # Neon connection string
MOCK_MODE=false                # enables LINE signature verification
LINE_CHANNEL_SECRET=...        # required when MOCK_MODE=false
```

---

## Non-Goals

- Real embedding generation (can be added later — schema ready)
- Real Claude API calls (mock Claude response unchanged)
- JWT authentication middleware (out of scope for this spec)
- LINE reply (webhook is receive-only for now)

---

## Upgrade Path

After demo, to enable real embeddings:
1. Add `OPENAI_API_KEY` (or Cohere/Voyage)
2. Run embedding script to populate `embedding` column
3. Change retrieval to use `<=> cosine_distance` in SQL
4. No schema changes needed
