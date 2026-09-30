'use strict';
const { pool, migrate } = require('./db');

migrate()
  .then(() => { console.log('migrations: ok'); return pool.end(); })
  .catch((e) => { console.error('migrations failed:', e.message); process.exit(1); });
