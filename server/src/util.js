'use strict';
/* Общие помощники API: ответы, чтение тела запроса, лимиты, пароли. */
const crypto = require('crypto');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const genToken = () => crypto.randomBytes(32).toString('base64url');

class HttpError extends Error {
  constructor(status, msg, code) { super(msg); this.status = status; this.code = code || ''; }
}

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};
function send(res, status, body, headers) {
  const isBuf = Buffer.isBuffer(body);
  const text = isBuf || typeof body === 'string';
  const data = text ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({}, BASE_HEADERS, { 'Content-Type': text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8' }, headers || {}));
  res.end(data);
}
const json = (res, status, obj, headers) => send(res, status, obj, headers);

/* адрес клиента: за Caddy берем X-Real-IP, который выставляет сам Caddy (заголовку от клиента не доверяем) */
function clientIp(req) {
  const ra = req.socket.remoteAddress || '';
  if (ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1') {
    const real = String(req.headers['x-real-ip'] || '').trim();
    if (real) return real.slice(0, 64);
    if (req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim().slice(0, 64);
  }
  return ra;
}
/* ключ для лимитов: IPv6 группируем по /64, чтобы один клиент не получал бесконечно много счетчиков */
function ipKey(ip) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (ip.indexOf(':') < 0) return ip;
  const parts = ip.split('::');
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
  const full = head.concat(new Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), tail);
  return full.slice(0, 4).map((x) => x.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const buf = await readBody(req, limit || 64 * 1024);
  if (!buf.length) return {};
  let o;
  try { o = JSON.parse(buf.toString('utf8')); } catch (_) { throw new HttpError(400, 'Некорректный JSON'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new HttpError(400, 'Некорректный запрос');
  return o;
}

/* лимиты запросов: фиксированное окно в памяти процесса */
const RL = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  let r = RL.get(key);
  if (!r || r.reset < now) { r = { n: 0, reset: now + windowMs }; RL.set(key, r); }
  r.n++;
  if (r.n > max) throw new HttpError(429, 'Слишком много попыток, попробуйте через несколько минут');
}
function resetLimit(key) { RL.delete(key); }
/* счетчик неудач: проверяется до попытки, увеличивается только после ошибки */
function failures(key) { const r = RL.get(key); return r && r.reset >= Date.now() ? r.n : 0; }
function addFailure(key, windowMs) { const now = Date.now(); let r = RL.get(key); if (!r || r.reset < now) { r = { n: 0, reset: now + windowMs }; RL.set(key, r); } r.n++; }
setInterval(() => { const now = Date.now(); for (const [k, r] of RL) if (r.reset < now) RL.delete(k); }, 60000).unref();

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) { /* skip */ } }
  });
  return out;
}

/* пароли: scrypt в пуле потоков, чтобы не блокировать сервер */
const MAXMEM = 64 * 1024 * 1024;
function scrypt(pw, salt, opts) {
  return new Promise((resolve, reject) => crypto.scrypt(pw, salt, 64, Object.assign({ maxmem: MAXMEM }, opts), (e, k) => (e ? reject(e) : resolve(k))));
}
async function hashPassword(pw, N) {
  N = N || 16384;
  const salt = crypto.randomBytes(16);
  const h = await scrypt(String(pw), salt, { N, r: 8, p: 1 });
  return ['scrypt', N, 8, 1, salt.toString('base64'), h.toString('base64')].join('$');
}
async function checkPassword(pw, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 6 || p[0] !== 'scrypt') return false;
  const h = await scrypt(String(pw), Buffer.from(p[4], 'base64'), { N: Number(p[1]), r: Number(p[2]), p: Number(p[3]) });
  const want = Buffer.from(p[5], 'base64');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}
let DUMMY = null;
async function dummyCheck(pw) { if (!DUMMY) DUMMY = await hashPassword('dummy-password-for-timing'); await checkPassword(pw, DUMMY); return false; }

const TMP_ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
function tempPassword() {
  const b = crypto.randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) s += TMP_ABC[b[i] % TMP_ABC.length];
  return s;
}

module.exports = { sha, genToken, HttpError, BASE_HEADERS, send, json, clientIp, ipKey, readBody, readJson, limit, resetLimit, failures, addFailure, cookies, hashPassword, checkPassword, dummyCheck, tempPassword };
