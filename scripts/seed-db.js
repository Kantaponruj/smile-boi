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
