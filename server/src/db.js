'use strict';
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v);   // date -> 'YYYY-MM-DD' без сдвига часового пояса
types.setTypeParser(20, (v) => Number(v));   // bigint (суммы) -> число

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c TimeZone=' + (process.env.DB_TZ || 'Asia/Almaty'),   // дни и графики в админке считаются по времени Алматы
});
pool.on('error', (e) => console.error('pg pool error:', e.message));

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = await fn(client);
    await client.query('commit');
    return r;
  } catch (e) {
    try { await client.query('rollback'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

async function migrate(log) {
  log = log || console.log;
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const { rows } = await pool.query('select name from schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await tx(async (c) => {
      await c.query(sql);
      await c.query('insert into schema_migrations (name) values ($1)', [f]);
    });
    log('migration applied: ' + f);
  }
}

module.exports = { pool, tx, migrate };
