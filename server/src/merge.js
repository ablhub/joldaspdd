'use strict';
/* Очистка и слияние прогресса. Та же логика продублирована в src/app.js сайта (syncMerge). */

const MAX_EXAMS = 30;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,40}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CATS = ['A1', 'A', 'B1', 'B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D1', 'D', 'D1E', 'DE', 'Tb', 'Tm'];
const SKEW = 60e3;                     // допуск на неточные часы устройства
const DAY = 86400e3;
const MAX_DELTA_Q = 20, MAX_DELTA_PUT = 3000;

/* известные id вопросов и тем (из банка на сайте): неизвестные id в статистику и прогресс не попадают */
let KNOWN_Q = null, KNOWN_M = null;
function setKnown(q, m) { KNOWN_Q = q; KNOWN_M = m; }
const okQ = (id) => ID_RE.test(id) && (!KNOWN_Q || KNOWN_Q.has(id));
const okM = (id) => ID_RE.test(id) && (!KNOWN_M || KNOWN_M.has(id));

function num(x, d) { x = Number(x); return Number.isFinite(x) ? x : d; }
function int(x, lo, hi, d) { x = Math.trunc(num(x, d)); return Math.max(lo, Math.min(hi, x)); }
function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function ts(x, now) { return Math.max(0, Math.min(now + SKEW, num(x, 0))); }
function realDay(k, now) {
  const m = DATE_RE.exec(k || '');
  if (!m) return false;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 2020 && t <= now + 2 * DAY;
}

function cleanQ(r, now) {
  if (!isObj(r)) return null;
  const a = int(r.a, 0, 100000, 0);
  return { a, c: int(r.c, 0, a, 0), box: int(r.box, 0, 5, 0), due: Math.max(0, Math.min(now + 400 * DAY, num(r.due, 0))), t: ts(r.t, now), ok: r.ok ? 1 : 0 };
}

function cleanExam(e, now) {
  if (!isObj(e)) return null;
  const ts0 = num(e.ts, 0);
  if (!(ts0 > 0) || ts0 > now + DAY) return null;
  const ts = ts0;
  const wrong = Array.isArray(e.wrong)
    ? e.wrong.slice(0, 60).filter((w) => Array.isArray(w) && typeof w[0] === 'string' && ID_RE.test(w[0])).map((w) => [w[0], int(w[1], -1, 10, -1)])
    : [];
  const n = int(e.n, 1, 100, 40);
  const out = { ts, n, c: int(e.c, 0, n, 0), dur: int(e.dur, 0, 100000, 0), wrong, auto: !!e.auto };
  if (typeof e.cat === 'string' && /^[A-Za-z0-9]{1,4}$/.test(e.cat)) out.cat = e.cat;
  return out;
}

/* Оставляет только известные поля. Имя пользователя и незавершенный экзамен на сервер не попадают. */
function sanitize(s, now) {
  now = now || Date.now();
  s = isObj(s) ? s : {};
  const p = isObj(s.profile) ? s.profile : {};
  const out = { v: 1, resetAt: Math.min(now, ts(s.resetAt, now)) };
  out.profile = {
    examDate: realDay(p.examDate, now + 800 * DAY) ? p.examDate : '',
    daily: [20, 30, 50].includes(num(p.daily, 30)) ? num(p.daily, 30) : 30,
    cat: CATS.includes(p.cat) ? p.cat : 'B',
    mt: ts(p.mt, now),
  };
  out.q = {};
  if (isObj(s.q)) for (const id of Object.keys(s.q).slice(0, 5000)) { if (!okQ(id)) continue; const r = cleanQ(s.q[id], now); if (r) out.q[id] = r; }
  out.read = {};
  if (isObj(s.read)) for (const k of Object.keys(s.read).slice(0, 300)) if (okM(k)) { const t = ts(s.read[k], now); if (t > 0) out.read[k] = t; }
  out.days = {};
  if (isObj(s.days)) for (const k of Object.keys(s.days).slice(-800)) if (realDay(k, now) && isObj(s.days[k])) { const n = int(s.days[k].n, 0, 100000, 0); out.days[k] = { n, c: int(s.days[k].c, 0, n, 0) }; }
  out.exams = Array.isArray(s.exams) ? s.exams.slice(-MAX_EXAMS).map((e) => cleanExam(e, now)).filter(Boolean) : [];
  out.adone = {};
  if (isObj(s.adone)) for (const k of Object.keys(s.adone).slice(0, 300)) if (ID_RE.test(k)) out.adone[k] = Math.max(1, ts(s.adone[k], now));
  out.chk = {};
  if (isObj(s.chk)) for (const k of Object.keys(s.chk).slice(0, 300)) if (/^[A-Za-z0-9]{1,40}$/.test(k) && s.chk[k]) out.chk[k] = 1;
  return out;
}

/* Слияние двух очищенных состояний. По каждому вопросу побеждает более свежий ответ. Сброс прогресса (resetAt) отбрасывает все, что было раньше него. */
function merge(a, b) {
  if (!a || !a.v) return b;
  if (!b || !b.v) return a;
  const resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
  const keep = (t) => !resetAt || (t || 0) >= resetAt;
  const out = { v: 1, resetAt };
  out.profile = (b.profile.mt || 0) >= (a.profile.mt || 0) ? b.profile : a.profile;
  out.q = {};
  for (const src of [a.q, b.q]) for (const id in src) {
    const r = src[id];
    if (!keep(r.t)) continue;
    const cur = out.q[id];
    if (!cur || (r.t || 0) > (cur.t || 0)) out.q[id] = r;
  }
  out.read = {};
  for (const src of [a.read, b.read]) for (const k in src) { if (keep(src[k])) out.read[k] = Math.max(out.read[k] || 0, src[k]); }
  out.days = {};
  for (const src of [a.days, b.days]) for (const k in src) {
    if (resetAt && Date.parse(k + 'T23:59:59Z') < resetAt) continue;
    const d = src[k], cur = out.days[k];
    out.days[k] = cur ? { n: Math.max(cur.n, d.n), c: Math.max(cur.c, d.c) } : d;
  }
  const ex = new Map();
  for (const e of a.exams.concat(b.exams)) if (keep(e.ts)) ex.set(e.ts, e);
  out.exams = [...ex.values()].sort((x, y) => x.ts - y.ts).slice(-MAX_EXAMS);
  out.adone = {};
  for (const src of [a.adone, b.adone]) for (const k in src) { if (keep(src[k])) out.adone[k] = Math.max(out.adone[k] || 0, src[k]); }
  const newerReset = (b.resetAt || 0) > (a.resetAt || 0);
  out.chk = Object.assign({}, newerReset ? {} : a.chk, b.chk);
  return out;
}

/* Приросты попыток по вопросам (для общей статистики): сравнение пришедшего состояния с сохраненным до слияния. */
function statDeltas(stored, incoming) {
  const out = [];
  const sq = (stored && stored.q) || {};
  let total = 0;
  for (const id in incoming.q) {
    const n = incoming.q[id], o = sq[id];
    let da = o ? n.a - o.a : n.a;
    const dc = o ? n.c - o.c : n.c;
    if (!(da > 0)) continue;
    da = Math.min(da, MAX_DELTA_Q);
    if (total + da > MAX_DELTA_PUT) break;
    total += da;
    out.push([id, da, Math.max(0, Math.min(da, dc))]);
  }
  return out;
}

function newExams(stored, incoming) {
  const seen = new Set(((stored && stored.exams) || []).map((e) => e.ts));
  return incoming.exams.filter((e) => !seen.has(e.ts));
}

module.exports = { sanitize, merge, statDeltas, newExams, setKnown, MAX_EXAMS, CATS };
