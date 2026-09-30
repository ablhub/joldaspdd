'use strict';
/* Жолдас ПДД: API (регистрация, прогресс, пробный тест) и админка. Без фреймворков: http + pg. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pool, migrate } = require('./db');
const { HttpError, send, json } = require('./util');
const { reqLang, tr } = require('./i18n');
const { setKnown } = require('./merge');
const adminPage = require('./admin');
const usersApi = require('./users');
const adminApi = require('./adminApi');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = process.env.PUBLIC_DIR || '';          // только для локальной разработки
const VERSION = adminApi.VERSION;

const ADMIN_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY',
};

const ROUTES = Object.assign({
  'GET /api/v1/health': (req, res) => json(res, 200, { ok: true, version: VERSION, time: Date.now() }, { 'Access-Control-Allow-Origin': '*' }),
  'GET /admin': (req, res) => send(res, 200, adminPage, ADMIN_HEADERS),
}, usersApi.routes, adminApi.routes);

const USER_RE = /^\/admin\/api\/users\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/([a-z-]+))?$/;

/* ---------- статика (только для разработки) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (_) { return send(res, 400, 'Bad request'); }
  if (rel === '/' || rel === '') rel = '/index.html';
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(path.normalize(PUBLIC_DIR))) return send(res, 403, 'Forbidden');
  /* каталог без расширения (/kk, /en): страница языка <каталог>/index.html */
  if (!path.extname(file)) { try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (_) { /* нет такого пути: 404 ниже */ } }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  let p;
  try { p = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '') || '/'; } catch (_) { return send(res, 400, 'Bad request'); }
  const lang = p.startsWith('/admin') ? 'ru' : reqLang(req);   // ответы ученикам на языке страницы, админке по-русски
  try {
    const h = ROUTES[req.method + ' ' + p];
    if (h) return await h(req, res);
    const m = USER_RE.exec(p);
    if (m) {
      const uh = adminApi.userRoutes[req.method + ' ' + (m[2] || '')];
      if (uh) return await uh(req, res, m[1]);
    }
    if (req.method === 'OPTIONS' && p === '/api/v1/health') return send(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    if (PUBLIC_DIR && req.method === 'GET' && !p.startsWith('/api/') && !p.startsWith('/admin')) return serveStatic(req, res, p);
    return json(res, 404, { error: tr('Не найдено', lang) });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(req.method, p, (e && e.stack) || e);
    if (!res.headersSent) json(res, status, { error: tr(status === 500 ? 'Ошибка сервера' : e.message, lang), code: (e && e.code && status !== 500) ? e.code : undefined });
    else res.end();
  }
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;

/* уборка: старые сессии устройств (180 дней без входа) */
function cleanup() {
  pool.query("delete from devices where last_seen_at < now() - interval '180 days'").catch((e) => console.error('cleanup:', e.message));
  pool.query('delete from admin_sessions where expires_at < now()').catch(() => {});
}

/* id вопросов и тем из банка на сайте: прогресс и статистика принимают только их (берем из assets/qindex.json, который собирает сборка сайта) */
function loadKnownIds() {
  const files = [process.env.PUBLIC_DIR && path.join(process.env.PUBLIC_DIR, 'assets', 'qindex.json'), path.join(__dirname, '..', '..', 'public', 'assets', 'qindex.json')].filter(Boolean);
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      const q = new Set(Object.keys(d.q)), mods = new Set(Object.keys(d.m));
      (d.z || []).forEach((code) => q.add('zn-' + code));
      setKnown(q, mods);
      console.log('known ids: ' + q.size + ' questions, ' + mods.size + ' modules');
      return;
    } catch (e) { console.error('known ids: ' + e.message); }
  }
}

async function start() {
  loadKnownIds();
  if (process.env.MIGRATE_ON_START !== '0') await migrate();
  server.listen(PORT, HOST, () => console.log('joldas-api ' + VERSION + ' listening on ' + HOST + ':' + PORT));
  setInterval(cleanup, 6 * 3600e3).unref();
  adminApi.startAutoUpdate();
}
function stop() { server.close(() => pool.end().then(() => process.exit(0))); setTimeout(() => process.exit(0), 5000).unref(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

if (require.main === module) start().catch((e) => { console.error('start failed:', e.message); process.exit(1); });
module.exports = { server, start };
