// scripts/seed-db.js
// Run once: node scripts/seed-db.js
// Requires DATABASE_URL in .env.local
require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL in .env.local before seeding');

  const sql = neon(url);

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
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
  `;

  await sql`
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
  `;

  const countRows = await sql`SELECT COUNT(*) AS cnt FROM rulebook_chunks WHERE version = ${'v3.0'}`;
  const count = parseInt(countRows[0].cnt, 10);

  if (count < 11) {
    await sql`DELETE FROM rulebook_chunks WHERE version = ${'v3.0'}`;

    const chunks = [
      ['1.0', '#General_Inquiry — ข้อความทั่วไปที่ไม่สามารถระบุเจตนาได้ เช่น "สวัสดี", "ขอถามหน่อย", "มีอะไรแนะนำไหม"'],
      ['2.1', '#Product_Inquiry — ลูกค้าสอบถามข้อมูลหรือรายละเอียดสินค้า เช่น "ขอสเปคสินค้าหน่อย", "มีประกันไหม", "สินค้ามีกี่แบบ"'],
      ['2.2', '#Promotion_Inquiry — ลูกค้าสอบถามโปรโมชั่นหรือส่วนลด เช่น "มีโปรไหมครับ", "ลดราคาได้ไหม", "มีของแถมไหม"'],
      ['2.3', '#Quotation_Request — ลูกค้าส่งข้อความขอราคาหรือใบเสนอราคา เช่น "ขอใบเสนอราคา", "ราคาเท่าไหร่", "สั่งซื้อจำนวนมากได้ไหม"'],
      ['3.1', '#Purchase_Intent — ลูกค้าแสดงเจตนาซื้อแต่ยังไม่ยืนยัน เช่น "กำลังพิจารณา", "สนใจอยู่", "น่าสนใจดี"'],
      ['3.2', '#Order_Confirmation — ลูกค้ายืนยันการสั่งซื้อ เช่น "สั่งเลยครับ", "ขอสั่ง 10 ชิ้น", "ยืนยันออเดอร์นี้ได้เลย"'],
      ['4.1', '#Follow_Up — ลูกค้าติดตามเรื่องที่ค้างไว้ เช่น "ติดตามเรื่องใบเสนอราคา", "ได้รับอีเมลยังครับ", "ความคืบหน้าเป็นยังไง"'],
      ['4.2', '#Complaint — ลูกค้าร้องเรียนหรือแจ้งปัญหา เช่น "สินค้าไม่ตรงปก", "ไม่พอใจบริการ", "เกิดปัญหาตอนจัดส่ง"'],
      ['4.4', '#Delivery_Inquiry — ลูกค้าสอบถามสถานะการจัดส่ง เช่น "ของส่งเมื่อไหร่", "เลขพัสดุคืออะไร", "ได้รับของยังครับ"'],
      ['5.1', '#Payment_Inquiry — ลูกค้าสอบถามการชำระเงิน เช่น "โอนได้เลยไหม", "รับบัตรเครดิตไหม", "พร้อมเพย์ได้ไหม"'],
      ['5.2', '#Payment_Confirmation — ลูกค้าแจ้งชำระเงินแล้ว เช่น "โอนแล้วนะครับ", "ส่งสลิปให้", "ชำระเงินเรียบร้อย"'],
    ];

    for (const [section, content] of chunks) {
      await sql`
        INSERT INTO rulebook_chunks (document_id, version, section_id, effective_date, scope, access_level, content)
        VALUES ('corporate-tagging-rulebook', 'v3.0', ${section}, '2026-01-01'::date, 'general', 'agent', ${content})
      `;
    }
    console.log('Rulebook chunks seeded (11 rows)');
  } else {
    console.log(`Rulebook chunks already up to date (${count} rows) — skipping seed`);
  }

  console.log('Done.');
}

seed().catch(err => { console.error(err); process.exit(1); });
