'use strict';
/* API админки: вход, обзор площадки, лента активности, управление пользователями, настройки, обслуживание сервера. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const { pool, tx } = require('./db');
const V = require('./validate');
const { pipeline } = require('stream');
const { sha, genToken, HttpError, BASE_HEADERS, json, clientIp, ipKey, readBody, readJson, limit, failures, addFailure, cookies, hashPassword, checkPassword, tempPassword } = require('./util');
const { getSettings, setSettings } = require('./settings');
const { logEvent } = require('./users');

const VAR = process.env.JOLDAS_VAR || '/var/lib/joldas';
const DEPLOY_STATUS = process.env.DEPLOY_STATUS || '/var/lib/joldas-deploy/status.json';   // пишет root при установке релиза
const intParam = (v, d, lo, hi) => { const n = /^\d{1,9}$/.test(String(v == null ? '' : v)) ? Number(v) : d; return Math.max(lo, Math.min(hi, n)); };
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/joldas';
const PUBLIC_IP = process.env.PUBLIC_IP || '';
const DEV = process.env.NODE_ENV !== 'production';
let VERSION = 'dev';
try { VERSION = fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim(); } catch (_) { /* dev */ }

async function getKv(key) { const { rows } = await pool.query('select value from admin_kv where key = $1', [key]); return rows.length ? rows[0].value : null; }
async function setKv(key, value) { await pool.query('insert into admin_kv (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()', [key, value]); }
async function audit(action, target, data) { await pool.query('insert into admin_audit (action, target, data) values ($1, $2, $3)', [action, target || null, data || {}]); }

function requireXhr(req) { if (req.headers['x-requested-with'] !== 'joldas') throw new HttpError(403, 'Запрос отклонен'); }
async function authAdmin(req) {
  const t = cookies(req).jadmin;
  if (!t) throw new HttpError(401, 'Нужен вход');
  const { rows } = await pool.query('select 1 from admin_sessions where token_hash = $1 and expires_at > now()', [sha(t)]);
  if (!rows.length) throw new HttpError(401, 'Сессия истекла, войдите снова');
}
const mutate = async (req) => { requireXhr(req); await authAdmin(req); };
function sessionCookie(token, maxAge) { return 'jadmin=' + token + '; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (DEV ? '' : '; Secure'); }
async function startSession(res) {
  const token = genToken();
  await pool.query("insert into admin_sessions (token_hash, expires_at) values ($1, now() + interval '12 hours')", [sha(token)]);
  await pool.query('delete from admin_sessions where expires_at < now()');
  return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, 43200) });
}

/* ---------- вход ---------- */
async function whoami(req, res) {
  const configured = !!(await getKv('password'));
  let authed = false;
  try { await authAdmin(req); authed = true; } catch (_) { /* нет */ }
  return json(res, 200, { configured, authed, setupPending: fs.existsSync(path.join(VAR, 'setup-code')), version: VERSION });
}
async function setup(req, res) {
  requireXhr(req);
  limit('setup:' + clientIp(req), 10, 900e3);
  const body = await readJson(req);
  if (await getKv('password')) throw new HttpError(409, 'Пароль уже задан');
  let code = '';
  try { code = fs.readFileSync(path.join(VAR, 'setup-code'), 'utf8').trim(); } catch (_) { throw new HttpError(403, 'Настройка недоступна: нет кода установки'); }
  const given = Buffer.from(String(body.code || '')), want = Buffer.from(code);
  if (!code || given.length !== want.length || !crypto.timingSafeEqual(given, want)) throw new HttpError(403, 'Неверная ссылка настройки');
  const pw = String(body.password || '');
  if (pw.length < 10) throw new HttpError(400, 'Пароль не короче 10 символов');
  await setKv('password', await hashPassword(pw, 32768));
  try { fs.unlinkSync(path.join(VAR, 'setup-code')); } catch (_) { /* уже нет */ }
  await audit('admin_setup', null, {});
  return startSession(res);
}
async function login(req, res) {
  requireXhr(req);
  const ik = ipKey(clientIp(req));
  if (failures('alf:' + ik) >= 10 || failures('alf:*') >= 50) throw new HttpError(429, 'Слишком много неудачных попыток входа. Подождите 15 минут');
  const body = await readJson(req);
  const stored = await getKv('password');
  if (!stored) throw new HttpError(409, 'Пароль еще не задан');
  if (!(await checkPassword(String(body.password || ''), stored))) { addFailure('alf:' + ik, 900e3); addFailure('alf:*', 900e3); await audit('admin_login_failed', null, { ip: clientIp(req) }); throw new HttpError(403, 'Неверный пароль'); }
  await audit('admin_login', null, { ip: clientIp(req) });
  return startSession(res);
}
async function logout(req, res) {
  requireXhr(req);
  const t = cookies(req).jadmin;
  if (t) await pool.query('delete from admin_sessions where token_hash = $1', [sha(t)]);
  return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
}
async function password(req, res) {
  await mutate(req);
  const body = await readJson(req);
  if (!(await checkPassword(String(body.current || ''), await getKv('password')))) throw new HttpError(403, 'Текущий пароль неверный');
  const pw = String(body.next || '');
  if (pw.length < 10) throw new HttpError(400, 'Пароль не короче 10 символов');
  await setKv('password', await hashPassword(pw, 32768));
  await pool.query('delete from admin_sessions');
  await audit('admin_password', null, {});
  return startSession(res);
}

/* ---------- обзор ---------- */
async function overview(req, res) {
  await authAdmin(req);
  const u = new URL(req.url, 'http://x');
  const days = intParam(u.searchParams.get('days'), 30, 7, 90);
  const minAttempts = intParam(u.searchParams.get('min'), 20, 1, 10000);
  const [tot, series, cats, ages, hard, lessons, langs, settings] = await Promise.all([
    pool.query(`select
      (select count(*) from users)::int as users_total,
      (select count(*) from users where created_at >= current_date)::int as new_today,
      (select count(*) from users where created_at >= current_date - 6)::int as new_7d,
      (select count(*) from users where created_at >= current_date - 29)::int as new_30d,
      (select count(*) from users where last_seen_at > now() - interval '15 minutes')::int as online,
      (select count(*) from users where last_seen_at >= current_date)::int as active_today,
      (select count(*) from users where last_seen_at >= current_date - 6)::int as active_7d,
      (select count(*) from users where last_seen_at >= current_date - 29)::int as active_30d,
      (select coalesce(sum(answers), 0) from user_days where day = current_date)::bigint as answers_today,
      (select coalesce(sum(attempts), 0) from question_stats)::bigint as answers_total,
      (select coalesce(sum(correct), 0) from question_stats)::bigint as answers_correct,
      (select count(*) from exam_results)::int as exams_total,
      (select count(*) from exam_results where correct >= 32)::int as exams_passed,
      (select count(*) from exam_results where taken_at >= current_date)::int as exams_today,
      (select count(*) from trial_results)::int as trials_total,
      (select count(*) from trial_results where at >= current_date - 29)::int as trials_30d,
      (select count(*) from users where reg_trial and created_at >= current_date - 29)::int as reg_after_trial_30d,
      (select count(*) from users where marketing_consent)::int as marketing_yes,
      (select count(*) from users where status = 'blocked')::int as blocked`),
    pool.query(`with d as (select generate_series(current_date - ($1::int - 1), current_date, interval '1 day')::date as day)
      select to_char(d.day, 'YYYY-MM-DD') as day,
        (select count(*) from users x where x.created_at >= d.day and x.created_at < d.day + 1)::int as reg,
        (select count(*) from user_days x where x.day = d.day)::int as active,
        (select coalesce(sum(answers), 0) from user_days x where x.day = d.day)::bigint as answers,
        (select count(*) from exam_results x where x.taken_at >= d.day and x.taken_at < d.day + 1)::int as exams,
        (select count(*) from exam_results x where x.taken_at >= d.day and x.taken_at < d.day + 1 and x.correct >= 32)::int as passed,
        (select count(*) from trial_results x where x.at >= d.day and x.at < d.day + 1)::int as trials
      from d order by d.day`, [days]),
    pool.query("select coalesce(category, '?') as cat, count(*)::int as n from users group by 1 order by 2 desc"),
    pool.query(`select case when a < 18 then '14-17' when a < 25 then '18-24' when a < 35 then '25-34' when a < 45 then '35-44' else '45+' end as bucket, count(*)::int as n
      from (select extract(year from age(current_date, birth_date))::int as a from users where birth_date is not null) s group by 1`),
    pool.query(`select question_id, attempts::int, correct::int, round(correct::numeric / attempts, 3)::float as acc
      from question_stats where attempts >= $1 and question_id not like 'zn-%' order by acc asc, attempts desc limit 30`, [minAttempts]),
    pool.query("select data->>'mod' as mod, count(*)::int as n from events where type = 'lesson' group by 1 order by 2 desc limit 25"),
    pool.query('select lang, count(*)::int as n from users group by 1 order by 2 desc'),
    getSettings(),
  ]);
  const setupMissing = !settings.operatorName || !settings.supportText;
  return json(res, 200, { totals: tot.rows[0], series: series.rows, categories: cats.rows, ages: ages.rows, langs: langs.rows, hardest: hard.rows, lessons: lessons.rows, minAttempts, days, version: VERSION, setupMissing });
}

/* ---------- активность ---------- */
const EVENT_TYPES = ['register', 'login', 'trial', 'exam', 'lesson', 'category', 'profile', 'consent', 'password', 'reset', 'logout_all', 'account_deleted'];
async function activity(req, res) {
  await authAdmin(req);
  const u = new URL(req.url, 'http://x');
  const type = EVENT_TYPES.includes(u.searchParams.get('type')) ? u.searchParams.get('type') : null;
  const before = /^\d{1,18}$/.test(u.searchParams.get('before') || '') ? u.searchParams.get('before') : null;
  const user = /^[0-9a-f-]{36}$/.test(u.searchParams.get('user') || '') ? u.searchParams.get('user') : null;
  const lim = intParam(u.searchParams.get('limit'), 60, 10, 200);
  const [ev, online] = await Promise.all([
    pool.query(`select e.id::text, e.at, e.type, e.data - 'ip' - 'ua' as data, e.user_id, u.first_name, u.last_name, u.category
      from events e left join users u on u.id = e.user_id
      where ($1::text is null or e.type = $1) and ($2::bigint is null or e.id < $2) and ($3::uuid is null or e.user_id = $3)
      order by e.id desc limit $4`, [type, before, user, lim]),
    pool.query(`select id, first_name, last_name, category, last_seen_at from users
      where last_seen_at > now() - interval '15 minutes' order by last_seen_at desc limit 60`),
  ]);
  return json(res, 200, { events: ev.rows, online: online.rows, types: EVENT_TYPES });
}

/* ---------- пользователи ---------- */
const SORTS = {
  new: 'u.created_at desc',
  active: 'u.last_seen_at desc',
  name: 'lower(u.last_name), lower(u.first_name)',
  answers: 'answers desc, u.created_at desc',
  exams: 'exams desc, u.created_at desc',
};
function userFilters(sp) {
  const where = [], vals = [];
  const q = String(sp.get('q') || '').trim().slice(0, 60);
  if (q) {
    const like = '%' + q.toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    vals.push(like);
    const i = vals.length;
    const digits = q.replace(/\D/g, '');
    let ph = '';
    if (digits.length >= 3) { vals.push('%' + digits + '%'); ph = ' or regexp_replace(u.phone, \'\\D\', \'\', \'g\') like $' + vals.length; }
    where.push('(lower(u.first_name || \' \' || u.last_name) like $' + i + ' or lower(u.last_name || \' \' || u.first_name) like $' + i + ph + ')');
  }
  const cat = sp.get('cat');
  if (cat && V.CATEGORIES.includes(cat)) { vals.push(cat); where.push('u.category = $' + vals.length); }
  const st = sp.get('status');
  if (st === 'active' || st === 'blocked') { vals.push(st); where.push('u.status = $' + vals.length); }
  const lg = sp.get('lang');
  if (lg && V.LANGS.includes(lg)) { vals.push(lg); where.push('u.lang = $' + vals.length); }
  const mk = sp.get('marketing');
  if (mk === '1') where.push('u.marketing_consent');
  if (mk === '0') where.push('not u.marketing_consent');
  const act = sp.get('active');
  if (act === '1') where.push("u.last_seen_at >= current_date - 6");
  if (act === '0') where.push("u.last_seen_at < current_date - 29");
  return { where: where.length ? 'where ' + where.join(' and ') : '', vals };
}
const LIST_SQL = `select u.id, u.first_name, u.last_name, u.phone, u.birth_date, u.category, u.lang, u.status, u.marketing_consent, u.marketing_consent_at,
    u.created_at, u.last_seen_at, u.reg_trial, u.guardian_consent, u.phone_verified_at,
    extract(year from age(current_date, u.birth_date))::int as age,
    coalesce(d.answers, 0) as answers, coalesce(d.correct, 0) as correct, coalesce(d.days, 0) as days,
    coalesce(x.exams, 0) as exams, coalesce(x.passed, 0) as passed
  from users u
  left join (select user_id, sum(answers)::bigint as answers, sum(correct)::bigint as correct, count(*)::int as days from user_days group by user_id) d on d.user_id = u.id
  left join (select user_id, count(*)::int as exams, (count(*) filter (where correct >= 32))::int as passed from exam_results group by user_id) x on x.user_id = u.id`;

async function users(req, res) {
  await authAdmin(req);
  const sp = new URL(req.url, 'http://x').searchParams;
  const f = userFilters(sp);
  const sort = Object.prototype.hasOwnProperty.call(SORTS, sp.get('sort')) ? SORTS[sp.get('sort')] : SORTS.new;
  const per = intParam(sp.get('per'), 50, 10, 200);
  const page = intParam(sp.get('page'), 1, 1, 100000);
  const [list, cnt] = await Promise.all([
    pool.query(LIST_SQL + ' ' + f.where + ' order by ' + sort + ' limit ' + per + ' offset ' + ((page - 1) * per), f.vals),
    pool.query('select count(*)::int as n from users u ' + f.where, f.vals),
  ]);
  return json(res, 200, { users: list.rows, total: cnt.rows[0].n, page, per });
}

function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
const fmtTs = (t) => (t ? new Date(new Date(t).getTime() + 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');
const LANG_NAMES = { ru: 'русский', kk: 'казахский', en: 'английский' };
async function usersCsv(req, res) {
  await authAdmin(req);
  const sp = new URL(req.url, 'http://x').searchParams;
  const f = userFilters(sp);
  const { rows } = await pool.query(LIST_SQL + ' ' + f.where + ' order by u.created_at desc limit 100000', f.vals);
  const head = ['Фамилия', 'Имя', 'Дата рождения', 'Возраст', 'Телефон', 'Телефон подтвержден', 'Категория', 'Язык интерфейса', 'Регистрация', 'Последняя активность', 'Решено вопросов', 'Экзаменов', 'Сдано', 'Согласие на рекламу', 'Дата согласия', 'Статус'];
  const lines = [head.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push([r.last_name, r.first_name, r.birth_date, r.age, V.phoneDigits(r.phone), r.phone_verified_at ? 'да' : 'нет', r.category, LANG_NAMES[r.lang] || r.lang, fmtTs(r.created_at), fmtTs(r.last_seen_at), r.answers, r.exams, r.passed,
      r.marketing_consent ? 'да' : 'нет', fmtTs(r.marketing_consent_at), r.status === 'blocked' ? 'заблокирован' : 'активен'].map(csvCell).join(';'));
  }
  const filters = {};
  for (const k of ['q', 'cat', 'lang', 'status', 'marketing', 'active']) if (sp.get(k)) filters[k] = sp.get(k);
  await audit('export_csv', null, { count: rows.length, filters });
  const name = 'joldas-users-' + new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10) + '.csv';
  res.writeHead(200, Object.assign({}, BASE_HEADERS, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + name + '"' }));
  res.end('\ufeff' + lines.join('\r\n') + '\r\n');
}

async function loadUser(id) {
  const { rows } = await pool.query(`select id, phone, first_name, last_name, birth_date, category, lang, status, blocked_reason, blocked_at, must_change_password,
      pd_consent_at, pd_consent_version, guardian_consent, marketing_consent, marketing_consent_at, marketing_withdrawn_at, reg_trial,
      created_at, updated_at, last_seen_at, last_login_at, phone_verified_at, version,
      extract(year from age(current_date, birth_date))::int as age,
      (select count(*) from jsonb_object_keys(coalesce(state->'q', '{}'::jsonb)))::int as q_seen,
      (select count(*) from jsonb_object_keys(coalesce(state->'read', '{}'::jsonb)))::int as lessons_read,
      state->'profile'->>'examDate' as exam_date
    from users where id = $1`, [id]);
  if (!rows.length) throw new HttpError(404, 'Пользователь не найден');
  return rows[0];
}
async function userDetail(req, res, id) {
  await authAdmin(req);
  const u = await loadUser(id);
  const [st, exams, days, events, devs, aud, reg] = await Promise.all([
    pool.query('select coalesce(sum(answers), 0)::bigint as answers, coalesce(sum(correct), 0)::bigint as correct, count(*)::int as days from user_days where user_id = $1', [id]),
    pool.query('select taken_at, total, correct, category from exam_results where user_id = $1 order by taken_at desc limit 30', [id]),
    pool.query("select to_char(day, 'YYYY-MM-DD') as day, answers, correct from user_days where user_id = $1 and day > current_date - 60 order by day", [id]),
    pool.query("select id::text, at, type, data - 'ip' - 'ua' as data from events where user_id = $1 order by id desc limit 100", [id]),
    pool.query('select count(*)::int as n, max(last_seen_at) as last from devices where user_id = $1', [id]),
    pool.query('select at, action, data from admin_audit where target = $1 order by id desc limit 30', [id]),
    pool.query("select data->>'ip' as ip, data->>'ua' as ua, at from events where user_id = $1 and type = 'register' order by id limit 1", [id]),
  ]);
  return json(res, 200, { user: u, stats: st.rows[0], exams: exams.rows, days: days.rows, events: events.rows, devices: devs.rows[0], audit: aud.rows, consentEvidence: reg.rows[0] || null });
}

async function userPatch(req, res, id) {
  await mutate(req);
  const u = await loadUser(id);
  const b = await readJson(req);
  const sets = [], vals = [id], changed = [];
  const add = (col, v, label) => { vals.push(v); sets.push(col + ' = $' + vals.length); changed.push(label); };
  if ('firstName' in b) { const v = V.name(b.firstName, 'имя'); if (v !== u.first_name) add('first_name', v, 'firstName'); }
  if ('lastName' in b) { const v = V.name(b.lastName, 'фамилию'); if (v !== u.last_name) add('last_name', v, 'lastName'); }
  if ('birthDate' in b) { const v = V.birthDate(b.birthDate); if (v !== u.birth_date) { add('birth_date', v, 'birthDate'); if (V.ageOf(v) < V.ADULT && u.marketing_consent) { sets.push('marketing_consent = false', 'marketing_withdrawn_at = now()'); changed.push('marketing'); } } }
  if ('phone' in b) { const v = V.phone(b.phone); if (v !== u.phone) { add('phone', v, 'phone'); sets.push('phone_verified_at = null'); } }
  if ('category' in b) {
    const v = V.category(b.category);
    if (v !== u.category) {
      add('category', v, 'category');
      vals.push(Date.now());
      sets.push("state = case when state ? 'profile' then jsonb_set(jsonb_set(state, '{profile,cat}', to_jsonb($" + (vals.length - 1) + "::text)), '{profile,mt}', to_jsonb($" + vals.length + "::bigint)) else state end");
    }
  }
  if (b.marketingConsent === false && u.marketing_consent) { sets.push('marketing_consent = false', 'marketing_withdrawn_at = now()'); changed.push('marketing'); }
  if (!sets.length) return json(res, 200, { ok: true, changed });
  try {
    await pool.query('update users set ' + sets.join(', ') + ', updated_at = now() where id = $1', vals);
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Этот телефон уже у другого пользователя');
    throw e;
  }
  await audit('user_edit', id, { changed });
  return json(res, 200, { ok: true, changed });
}
async function userBlock(req, res, id) {
  await mutate(req);
  await loadUser(id);
  const b = await readJson(req);
  const reason = String(b.reason || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 200);
  await tx(async (c) => {
    await c.query("update users set status = 'blocked', blocked_reason = $2, blocked_at = now() where id = $1", [id, reason || null]);
    await c.query('delete from devices where user_id = $1', [id]);
  });
  await audit('user_block', id, { reason });
  return json(res, 200, { ok: true });
}
async function userUnblock(req, res, id) {
  await mutate(req);
  await loadUser(id);
  await pool.query("update users set status = 'active', blocked_reason = null, blocked_at = null where id = $1", [id]);
  await audit('user_unblock', id, {});
  return json(res, 200, { ok: true });
}
async function userResetPassword(req, res, id) {
  await mutate(req);
  await loadUser(id);
  const pw = tempPassword();
  const hash = await hashPassword(pw);
  await tx(async (c) => {
    await c.query('update users set password_hash = $2, must_change_password = true, updated_at = now() where id = $1', [id, hash]);
    await c.query('delete from devices where user_id = $1', [id]);
  });
  await audit('user_reset_password', id, {});
  return json(res, 200, { ok: true, tempPassword: pw });
}
async function userLogoutAll(req, res, id) {
  await mutate(req);
  await loadUser(id);
  const r = await pool.query('delete from devices where user_id = $1', [id]);
  await audit('user_logout_all', id, { devices: r.rowCount });
  return json(res, 200, { ok: true, devices: r.rowCount });
}
async function userDelete(req, res, id) {
  await mutate(req);
  const u = await loadUser(id);
  await tx(async (c) => {
    await logEvent(c, null, 'account_deleted', { by: 'admin', cat: u.category });
    await c.query("update events set data = data - 'ip' - 'ua' where user_id = $1 and data ? 'ip'", [id]);
    await c.query('delete from users where id = $1', [id]);
  });
  await audit('user_delete', id, { cat: u.category });
  return json(res, 200, { ok: true });
}

/* ---------- настройки и журнал ---------- */
async function settingsGet(req, res) { await authAdmin(req); return json(res, 200, { settings: await getSettings() }); }
async function settingsSet(req, res) {
  await mutate(req);
  const b = await readJson(req);
  const s = await setSettings(b.settings || {});
  await audit('settings', null, {});
  return json(res, 200, { settings: s });
}
async function auditLog(req, res) {
  await authAdmin(req);
  const { rows } = await pool.query(`select a.at, a.action, a.data, a.target, u.first_name, u.last_name from admin_audit a
    left join users u on u.id = a.target order by a.id desc limit 100`);
  return json(res, 200, { audit: rows });
}

/* ---------- обслуживание ---------- */
function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR).filter((f) => /\.dump$/.test(f)).map((f) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: s.size, mtime: s.mtimeMs };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch (_) { return []; }
}
async function backups(req, res) { await authAdmin(req); return json(res, 200, { backups: listBackups() }); }
async function backupLatest(req, res) {
  await authAdmin(req);
  const b = listBackups()[0];
  if (!b) throw new HttpError(404, 'Резервных копий пока нет: первая создается ночью');
  await audit('backup_download', null, { name: b.name });
  const rs = fs.createReadStream(path.join(BACKUP_DIR, b.name));
  rs.once('open', () => {
    res.writeHead(200, Object.assign({}, BASE_HEADERS, { 'Content-Type': 'application/octet-stream', 'Content-Length': b.size, 'Content-Disposition': 'attachment; filename="' + b.name + '"' }));
    pipeline(rs, res, () => {});
  });
  rs.once('error', (e) => { if (!res.headersSent) json(res, 500, { error: 'Не удалось прочитать резервную копию' }); else res.destroy(e); });
}
/* обновление: принимаем только архив с подписью ключа релизов (JSIG). Подпись проверяет root перед установкой */
const checkSigned = (buf) => { if (buf.length < 1100 || buf.slice(0, 4).toString('latin1') !== 'JSIG' || buf[68] !== 0x1f || buf[69] !== 0x8b) throw new HttpError(400, 'Нужен подписанный архив релиза (.signed)'); };
async function queueRelease(buf, extra) {
  const dir = path.join(VAR, 'incoming');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'release-' + Date.now();
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  fs.writeFileSync(path.join(dir, name + '.part'), buf, { mode: 0o640 });
  fs.renameSync(path.join(dir, name + '.part'), path.join(dir, name + '.signed'));
  fs.writeFileSync(path.join(VAR, 'deploy-status.json'), JSON.stringify({ state: 'queued', file: name + '.signed', at: Date.now(), sha256: digest }));
  await audit('deploy', null, Object.assign({ sha256: digest, size: buf.length }, extra || {}));
  return { name: name + '.signed', digest };
}
async function deploy(req, res) {
  await mutate(req);
  const buf = await readBody(req, 40 * 1024 * 1024);
  checkSigned(buf);
  const q = await queueRelease(buf);
  return json(res, 202, { ok: true, queued: q.name, sha256: q.digest });
}
/* обновление с GitHub: берем файл joldas-release.signed из последнего опубликованного релиза репозитория (публичный репозиторий, токены не нужны).
   Откуда бы ни пришел файл, устанавливается он только при верной подписи ключа релизов (проверяет root), поэтому подменить код через GitHub нельзя. */
const GH_BASE = process.env.GITHUB_BASE || 'https://github.com';           // переопределяется только в тестах
const GH_REPO = process.env.GITHUB_REPO || 'ablhub/joldaspdd';
const GH_HOSTS = /^(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)$/;
function ghFetch(url, hops) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (_) { return reject(new HttpError(400, 'Неверный адрес')); }
    const custom = !!process.env.GITHUB_BASE;
    if (!custom && (u.protocol !== 'https:' || !GH_HOSTS.test(u.hostname))) return reject(new HttpError(400, 'Загрузка разрешена только с github.com'));
    const lib = u.protocol === 'http:' ? require('http') : require('https');
    const rq = lib.get(u, { headers: { 'User-Agent': 'joldas-updater', Accept: 'application/octet-stream' }, timeout: 60000 }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        if (hops >= 4) return reject(new HttpError(502, 'Слишком много перенаправлений GitHub'));
        return resolve(ghFetch(new URL(r.headers.location, u).toString(), hops + 1));
      }
      if (r.statusCode === 404) { r.resume(); return reject(new HttpError(404, 'В репозитории нет опубликованного релиза с файлом joldas-release.signed. Проверьте имя репозитория и что релиз опубликован (репозиторий должен быть публичным)')); }
      if (r.statusCode !== 200) { r.resume(); return reject(new HttpError(502, 'GitHub ответил кодом ' + r.statusCode)); }
      const chunks = []; let n = 0;
      r.on('data', (c) => { n += c.length; if (n > 40 * 1024 * 1024) { rq.destroy(); reject(new HttpError(413, 'Файл релиза слишком большой')); } else chunks.push(c); });
      r.on('end', () => resolve(Buffer.concat(chunks)));
      r.on('error', (e) => reject(new HttpError(502, 'Ошибка загрузки: ' + e.message)));
    });
    rq.on('timeout', () => { rq.destroy(); reject(new HttpError(504, 'GitHub не ответил за 60 секунд')); });
    rq.on('error', (e) => reject(e instanceof HttpError ? e : new HttpError(502, 'Не удалось связаться с GitHub: ' + e.message)));
  });
}
async function deployGithub(req, res) {
  await mutate(req);
  const b = await readJson(req);
  const repo = String((b && b.repo) || GH_REPO).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repo)) throw new HttpError(400, 'Репозиторий укажите в виде владелец/название, например ablhub/joldaspdd');
  const buf = await ghFetch(GH_BASE + '/' + repo + '/releases/latest/download/joldas-release.signed', 0);
  checkSigned(buf);
  const q = await queueRelease(buf, { source: 'github', repo });
  return json(res, 202, { ok: true, queued: q.name, sha256: q.digest, repo });
}
async function deployStatus(req, res) {
  await authAdmin(req);
  let st = {};
  for (const f of [path.join(VAR, 'deploy-status.json'), DEPLOY_STATUS]) {
    try { const x = JSON.parse(fs.readFileSync(f, 'utf8')); if (!st.at || (x.at || 0) >= st.at) st = x; } catch (_) { /* нет */ }
  }
  return json(res, 200, Object.assign({ version: VERSION, githubRepo: GH_REPO }, st));
}
function hostsForIp() {
  if (!PUBLIC_IP) return [];
  const d = PUBLIC_IP.replace(/\./g, '-');
  return [d + '.sslip.io', d + '.nip.io'];
}
async function domainGet(req, res) {
  await authAdmin(req);
  let domain = '';
  try { domain = fs.readFileSync(path.join(VAR, 'domain'), 'utf8').trim(); } catch (_) { /* нет */ }
  return json(res, 200, { domain, publicIp: PUBLIC_IP, hosts: hostsForIp() });
}
async function domainSet(req, res) {
  await mutate(req);
  const body = await readJson(req);
  const d = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (d && !/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) throw new HttpError(400, 'Некорректное имя домена');
  if (d && PUBLIC_IP && !process.env.SKIP_DNS_CHECK) {
    let ips = [];
    try { ips = await dns.resolve4(d); } catch (_) { /* записи нет */ }
    if (!ips.includes(PUBLIC_IP)) throw new HttpError(400, 'Домен пока не указывает на сервер. Добавьте у регистратора запись A: ' + d + ' -> ' + PUBLIC_IP + ' и подождите 5-30 минут');
  }
  fs.writeFileSync(path.join(VAR, 'domain'), d + '\n');
  await audit('domain', null, { domain: d });
  return json(res, 200, { ok: true, domain: d });
}

module.exports = {
  routes: {
    'GET /admin/api/whoami': whoami,
    'POST /admin/setup': setup,
    'POST /admin/login': login,
    'POST /admin/logout': logout,
    'POST /admin/api/password': password,
    'GET /admin/api/overview': overview,
    'GET /admin/api/activity': activity,
    'GET /admin/api/users': users,
    'GET /admin/api/users.csv': usersCsv,
    'GET /admin/api/settings': settingsGet,
    'POST /admin/api/settings': settingsSet,
    'GET /admin/api/audit': auditLog,
    'GET /admin/api/backups': backups,
    'GET /admin/backup/latest': backupLatest,
    'POST /admin/api/deploy': deploy,
    'POST /admin/api/deploy-github': deployGithub,
    'GET /admin/api/deploy-status': deployStatus,
    'GET /admin/api/domain': domainGet,
    'POST /admin/api/domain': domainSet,
  },
  userRoutes: {
    'GET ': userDetail,
    'PATCH ': userPatch,
    'DELETE ': userDelete,
    'POST block': userBlock,
    'POST unblock': userUnblock,
    'POST reset-password': userResetPassword,
    'POST logout-all': userLogoutAll,
  },
  VERSION,
};
