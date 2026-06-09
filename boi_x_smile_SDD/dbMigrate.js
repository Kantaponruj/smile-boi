// scripts/dbMigrate.js
// สร้าง tables ทั้งหมดที่จำเป็นสำหรับ smileChatBot

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  {
    name: '001_create_tagging_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS tagging_logs (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id           VARCHAR(100) NOT NULL,
        chat_message      TEXT,
        suggested_tag     VARCHAR(100),
        evidence_doc      VARCHAR(200),
        evidence_version  VARCHAR(20),
        evidence_section  VARCHAR(50),
        confidence_vector FLOAT,
        confidence_llm    FLOAT,
        confidence_final  FLOAT,
        confidence_level  VARCHAR(10),
        recommended_action VARCHAR(30),
        review_owner      VARCHAR(30),
        status            VARCHAR(30) DEFAULT 'tagged',
        agent_id          VARCHAR(100),
        created_at        TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tagging_logs_case_id ON tagging_logs(case_id);
      CREATE INDEX IF NOT EXISTS idx_tagging_logs_created_at ON tagging_logs(created_at);
    `
  },
  {
    name: '002_create_refusal_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS refusal_logs (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id          VARCHAR(100) NOT NULL,
        ai_suggestion    VARCHAR(100),
        refusal_reason   TEXT,
        confidence_final FLOAT,
        escalated_to     VARCHAR(100),
        timestamp        TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_refusal_logs_case_id ON refusal_logs(case_id);
    `
  },
  {
    name: '003_create_correction_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS correction_logs (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id               VARCHAR(100) NOT NULL,
        tagging_log_id        UUID REFERENCES tagging_logs(id),
        ai_suggested_tag      VARCHAR(100),
        human_corrected_tag   VARCHAR(100) NOT NULL,
        corrected_by          VARCHAR(100) NOT NULL,
        correction_reason     TEXT,
        timestamp             TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_correction_logs_case_id ON correction_logs(case_id);
    `
  },
  {
    name: '004_create_rulebook_chunks_registry',
    sql: `
      CREATE TABLE IF NOT EXISTS rulebook_chunks (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id      VARCHAR(100) NOT NULL,
        version          VARCHAR(20) NOT NULL,
        section_id       VARCHAR(50),
        effective_date   DATE NOT NULL,
        active_status    BOOLEAN DEFAULT TRUE,
        scope            VARCHAR(50) DEFAULT 'general',
        access_level     VARCHAR(30) DEFAULT 'agent',
        content_preview  TEXT,
        vector_id        VARCHAR(200),
        created_at       TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rulebook_chunks_active ON rulebook_chunks(active_status, effective_date DESC);
      CREATE INDEX IF NOT EXISTS idx_rulebook_chunks_scope ON rulebook_chunks(scope, access_level);
    `
  },
  {
    name: '005_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(200) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `
  }
];

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting smileChatBot database migration...\n');

    // สร้าง migrations table ก่อน
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        'SELECT id FROM schema_migrations WHERE name = $1',
        [migration.name]
      );

      if (rows.length > 0) {
        console.log(`  ✅ ${migration.name} — already applied`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${migration.name} — applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
