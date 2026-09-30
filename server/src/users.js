'use strict';
/* API учеников: регистрация по телефону и паролю, вход, профиль, прогресс, пробный тест гостя. */
const { pool, tx } = require('./db');
const { sanitize, merge, statDeltas, newExams } = require('./merge');
const V = require('./validate');
const { sha, genToken, HttpError, json, clientIp, ipKey, readJson, limit, failures, addFailure, hashPassword, checkPassword, dummyCheck } = require('./util');
const { getSettings } = require('./settings');
const { reqLang } = require('./i18n');

const CONSENT_VERSION = '2026-09-23';

function userJson(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    birthDate: u.birth_date,
    phone: u.phone,
    category: u.category,
    marketingConsent: !!u.marketing_consent,
    guardianConsent: !!u.guardian_consent,
    mustChangePassword: !!u.must_change_password,
    lang: u.lang || 'ru',
    pdConsentAt: u.pd_consent_at,
    createdAt: u.created_at,
  };
}
const stateOf = (u) => (u && u.state && u.state.v ? u.state : null);
const USER_COLS = ['id', 'phone', 'password_hash', 'must_change_password', 'first_name', 'last_name', 'birth_date', 'category', 'status',
  'marketing_consent', 'guardian_consent', 'pd_consent_at', 'created_at', 'version', 'lang'].map((c) => 'u.' + c).join(', ');

async function logEvent(db, userId, type, data, atMs) {
  await db.query('insert into events (user_id, type, data, at) values ($1, $2, $3, coalesce(to_timestamp($4::double precision / 1000), now()))',
    [userId || null, type, data || {}, atMs || null]);
}

async function authUser(req, opts) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, 'Войдите в аккаунт', 'auth');
  const th = sha(m[1]);
  const { rows } = await pool.query('update devices d set last_seen_at = now() from users u where d.token_hash = $1 and u.id = d.user_id returning ' + USER_COLS, [th]);
  if (!rows.length) throw new HttpError(401, 'Сессия завершена, войдите снова', 'auth');
  const u = rows[0];
  if (u.status === 'blocked') throw new HttpError(403, 'Аккаунт заблокирован. Обратитесь в поддержку', 'blocked');
  if (u.must_change_password && !(opts && opts.allowMustChange)) throw new HttpError(403, 'Задайте новый пароль, чтобы продолжить', 'must_change');
  pool.query("update users set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '1 minute'", [u.id]).catch(() => {});
  return { user: u, tokenHash: th };
}

/* побочные эффекты прогресса: общая статистика вопросов, активность по дням, экзамены и события */
async function applyProgress(c, userId, stored, incoming, merged, initial) {
  const deltas = statDeltas(stored, incoming);
  if (deltas.length) {
    await c.query(
      `insert into question_stats (question_id, attempts, correct)
       select * from unnest($1::text[], $2::bigint[], $3::bigint[])
       on conflict (question_id) do update set attempts = question_stats.attempts + excluded.attempts,
         correct = question_stats.correct + excluded.correct, updated_at = now()`,
      [deltas.map((d) => d[0]), deltas.map((d) => d[1]), deltas.map((d) => d[2])]
    );
  }
  if (initial) {
    const days = Object.keys(incoming.days || {}).filter((k) => incoming.days[k].n > 0).slice(-60);
    if (days.length) {
      await c.query(
        `insert into user_days (user_id, day, answers, correct)
         select $1, d::date, n, k from unnest($2::text[], $3::int[], $4::int[]) as x(d, n, k)
         on conflict (user_id, day) do nothing`,
        [userId, days, days.map((k) => incoming.days[k].n), days.map((k) => Math.min(incoming.days[k].n, incoming.days[k].c))]
      );
    }
  } else {
    const da = deltas.reduce((s, d) => s + d[1], 0), dc = deltas.reduce((s, d) => s + d[2], 0);
    if (da > 0) {
      await c.query(
        `insert into user_days (user_id, day, answers, correct) values ($1, current_date, $2, $3)
         on conflict (user_id, day) do update set answers = user_days.answers + excluded.answers, correct = user_days.correct + excluded.correct, last_at = now()`,
        [userId, da, dc]
      );
    }
  }
  const cat = merged.profile.cat;
  const exams = newExams(stored, incoming).filter((e) => e.ts > Date.now() - 400 * 86400e3 && e.ts < Date.now() + 86400e3);
  if (exams.length) {
    await c.query(
      `insert into exam_results (user_id, taken_at, total, correct, category)
       select $1, to_timestamp(t / 1000.0), n, k, $5 from unnest($2::bigint[], $3::int[], $4::int[]) as x(t, n, k)
       on conflict (user_id, taken_at) do nothing`,
      [userId, exams.map((e) => e.ts), exams.map((e) => e.n), exams.map((e) => e.c), cat]
    );
    for (const e of exams.slice(-10)) await logEvent(c, userId, 'exam', { n: e.n, c: e.c, pass: e.c >= 32, cat, auto: !!e.auto }, e.ts);
  }
  const sr = (stored && stored.read) || {};
  const read = Object.keys(incoming.read || {}).filter((k) => !sr[k] && merged.read[k]).slice(0, 30);
  for (const k of read) await logEvent(c, userId, 'lesson', { mod: k }, merged.read[k]);
  if (stored && stored.profile && stored.profile.cat && stored.profile.cat !== cat) await logEvent(c, userId, 'category', { from: stored.profile.cat, to: cat });
  if (stored && (merged.resetAt || 0) > (stored.resetAt || 0)) await logEvent(c, userId, 'reset', {});
}

/* ---------- публичные ---------- */
/* текст поддержки на языке страницы (X-Lang), если он задан в настройках; иначе русский */
async function config(req, res) {
  const s = await getSettings();
  const lang = reqLang(req);
  const supportText = (lang === 'kk' && s.supportTextKk) || (lang === 'en' && s.supportTextEn) || s.supportText;
  return json(res, 200, {
    support: { text: supportText, url: s.supportUrl },
    operator: { name: s.operatorName, id: s.operatorId, address: s.operatorAddress, contact: s.operatorContact },
    consentVersion: CONSENT_VERSION, minAge: V.MIN_AGE, adultAge: V.ADULT,
  }, { Vary: 'X-Lang' });
}

async function register(req, res) {
  const ip = clientIp(req);
  limit('reg:' + ipKey(ip), 20, 3600e3);
  const b = await readJson(req, 2 * 1024 * 1024);
  if (b.website) throw new HttpError(400, 'Не удалось зарегистрироваться');
  const firstName = V.name(b.firstName, 'имя');
  const lastName = V.name(b.lastName, 'фамилию');
  const birth = V.birthDate(b.birthDate);
  const cat = V.category(b.category);
  const phone = V.phone(b.phone);
  const pw = V.password(b.password);
  let lang;   // язык интерфейса: из формы, иначе язык страницы (X-Lang), иначе русский
  try { lang = V.lang(b.lang); } catch (_) { lang = reqLang(req); }
  if (b.pdConsent !== true) throw new HttpError(400, 'Нужно согласие на обработку персональных данных');
  const minor = V.ageOf(birth) < V.ADULT;
  if (minor && b.guardianConsent !== true) throw new HttpError(400, 'До 18 лет нужно согласие родителя или законного представителя');
  const marketing = !minor && b.marketingConsent === true;
  const state = sanitize(b.state);
  state.profile.cat = cat;
  state.profile.mt = Date.now();
  const hash = await hashPassword(pw);
  const token = genToken();
  let u;
  try {
    u = await tx(async (c) => {
      const { rows } = await c.query(
        `insert into users (phone, password_hash, first_name, last_name, birth_date, category, state, version,
           pd_consent_at, pd_consent_version, guardian_consent, marketing_consent, marketing_consent_at, reg_trial, last_login_at, lang)
         values ($1, $2, $3, $4, $5, $6, $7, 1, now(), $8, $9, $10::boolean, case when $10::boolean then now() end, $11, now(), $12) returning *`,
        [phone, hash, firstName, lastName, birth, cat, state, CONSENT_VERSION, minor, marketing, !!b.trial, lang]
      );
      const row = rows[0];
      await c.query('insert into devices (token_hash, user_id) values ($1, $2)', [sha(token), row.id]);
      await logEvent(c, row.id, 'register', { cat, trial: !!b.trial, marketing, minor, lang, ip, ua: String(req.headers['user-agent'] || '').slice(0, 160) });
      await applyProgress(c, row.id, null, state, state, true);
      return row;
    });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Этот номер уже зарегистрирован. Войдите по номеру и паролю', 'phone_taken');
    throw e;
  }
  return json(res, 201, { token, user: userJson(u), state: stateOf(u) });
}

/* вход: лимиты считают только неудачные попытки. Номер + адрес: 8 за 15 минут, номер с любых адресов: 40 */
async function login(req, res) {
  const ik = ipKey(clientIp(req));
  limit('login-ip:' + ik, 60, 900e3);
  const b = await readJson(req);
  let phone;
  try { phone = V.phone(b.phone); } catch (_) { throw new HttpError(400, 'Проверьте номер телефона'); }
  const kPI = 'lf:' + phone + ':' + ik, kP = 'lf:' + phone;
  if (failures(kPI) >= 8 || failures(kP) >= 40) throw new HttpError(429, 'Слишком много неудачных попыток. Попробуйте через 15 минут или обратитесь в поддержку');
  const pw = String(b.password || '');
  const { rows } = await pool.query('select * from users where phone = $1', [phone]);
  const u = rows[0];
  const ok = u ? await checkPassword(pw, u.password_hash) : await dummyCheck(pw);
  if (!u || !ok) { addFailure(kPI, 900e3); addFailure(kP, 900e3); throw new HttpError(403, 'Неверный телефон или пароль', 'bad_credentials'); }
  if (u.status === 'blocked') throw new HttpError(403, 'Аккаунт заблокирован. Обратитесь в поддержку', 'blocked');
  const token = genToken();
  await pool.query('insert into devices (token_hash, user_id) values ($1, $2)', [sha(token), u.id]);
  await pool.query('update users set last_login_at = now(), last_seen_at = now() where id = $1', [u.id]);
  await logEvent(pool, u.id, 'login', {});
  return json(res, 200, { token, user: userJson(u), state: stateOf(u) });
}

async function trial(req, res) {
  limit('trial:' + ipKey(clientIp(req)), 20, 3600e3);
  const b = await readJson(req);
  const n = Math.trunc(Number(b.n)), c = Math.trunc(Number(b.c));
  if (!(n >= 1 && n <= 40 && c >= 0 && c <= n)) throw new HttpError(400, 'Некорректный результат');
  let cat = 'B';
  try { cat = V.category(b.cat); } catch (_) { /* по умолчанию B */ }
  const dur = Math.max(0, Math.min(2400, Math.trunc(Number(b.dur) || 0)));
  await pool.query('insert into trial_results (category, total, correct, dur) values ($1, $2, $3, $4)', [cat, n, c, dur]);
  await logEvent(pool, null, 'trial', { n, c, cat, pass: c >= 32 });
  return json(res, 201, { ok: true });
}

/* ---------- для вошедших ---------- */
async function logout(req, res) {
  const { tokenHash } = await authUser(req, { allowMustChange: true });
  await pool.query('delete from devices where token_hash = $1', [tokenHash]);
  return json(res, 200, { ok: true });
}
async function logoutAll(req, res) {
  const { user } = await authUser(req);
  await pool.query('delete from devices where user_id = $1', [user.id]);
  await logEvent(pool, user.id, 'logout_all', {});
  return json(res, 200, { ok: true });
}
async function me(req, res) {
  const { user } = await authUser(req, { allowMustChange: true });
  return json(res, 200, { user: userJson(user) });
}
async function patchMe(req, res) {
  const { user } = await authUser(req);
  limit('patch:' + user.id, 60, 3600e3);
  const b = await readJson(req);
  const sets = [], vals = [user.id], fields = [];
  const add = (col, v) => { vals.push(v); sets.push(col + ' = $' + vals.length); };
  if ('firstName' in b) { const v = V.name(b.firstName, 'имя'); if (v !== user.first_name) { add('first_name', v); fields.push('firstName'); } }
  if ('lastName' in b) { const v = V.name(b.lastName, 'фамилию'); if (v !== user.last_name) { add('last_name', v); fields.push('lastName'); } }
  let lang = null;   // язык интерфейса меняет переключатель языка на сайте
  if ('lang' in b) { const v = V.lang(b.lang); if (v !== (user.lang || 'ru')) { add('lang', v); fields.push('lang'); lang = v; } }
  let birth = user.birth_date;
  if ('birthDate' in b) {
    const v = V.birthDate(b.birthDate);
    if (v !== user.birth_date) {
      if (V.ageOf(v) < V.ADULT && !user.guardian_consent) throw new HttpError(400, 'Для возраста до 18 лет нужно согласие родителя или законного представителя. Напишите в поддержку');
      add('birth_date', v); fields.push('birthDate'); birth = v;
    }
  }
  const adult = V.ageOf(birth) >= V.ADULT;
  let consent = null;
  if ('marketingConsent' in b) {
    const want = b.marketingConsent === true;
    if (want && !adult) throw new HttpError(400, 'Согласие на рекламные сообщения можно дать с 18 лет');
    if (want !== !!user.marketing_consent) consent = want;
  } else if (!adult && user.marketing_consent) consent = false;
  if (consent === true) sets.push('marketing_consent = true', 'marketing_consent_at = now()', 'marketing_withdrawn_at = null');
  if (consent === false) sets.push('marketing_consent = false', 'marketing_withdrawn_at = now()');
  if (!sets.length) return json(res, 200, { user: userJson(user) });
  const { rows } = await pool.query('update users set ' + sets.join(', ') + ', updated_at = now() where id = $1 returning *', vals);
  if (fields.length) await logEvent(pool, user.id, 'profile', lang ? { fields, lang } : { fields });
  if (consent !== null) await logEvent(pool, user.id, 'consent', { marketing: consent });
  return json(res, 200, { user: userJson(rows[0]) });
}
async function changePassword(req, res) {
  const { user, tokenHash } = await authUser(req, { allowMustChange: true });
  limit('pw:' + user.id, 10, 900e3);
  const b = await readJson(req);
  const next = V.password(b.next);
  if (!user.must_change_password && !(await checkPassword(String(b.current || ''), user.password_hash))) throw new HttpError(403, 'Текущий пароль неверный');
  const hash = await hashPassword(next);
  const { rows } = await pool.query('update users set password_hash = $2, must_change_password = false, updated_at = now() where id = $1 returning *', [user.id, hash]);
  await pool.query('delete from devices where user_id = $1 and token_hash <> $2', [user.id, tokenHash]);
  await logEvent(pool, user.id, 'password', {});
  return json(res, 200, { ok: true, user: userJson(rows[0]) });
}
async function deleteMe(req, res) {
  const { user } = await authUser(req);
  limit('del:' + user.id, 10, 900e3);
  const b = await readJson(req);
  if (!(await checkPassword(String(b.password || ''), user.password_hash))) throw new HttpError(403, 'Неверный пароль');
  await tx(async (c) => {
    await logEvent(c, null, 'account_deleted', { by: 'user', cat: user.category });
    await c.query("update events set data = data - 'ip' - 'ua' where user_id = $1 and data ? 'ip'", [user.id]);   // подтверждение согласия удаляем вместе с аккаунтом
    await c.query('delete from users where id = $1', [user.id]);
  });
  return json(res, 200, { ok: true });
}

async function getState(req, res) {
  const { user } = await authUser(req);
  const { rows } = await pool.query('select state, version from users where id = $1', [user.id]);
  if (!rows.length) throw new HttpError(401, 'Аккаунт удален', 'auth');
  return json(res, 200, { version: rows[0].version, state: stateOf(rows[0]), user: userJson(user), serverTime: Date.now() });
}
async function putState(req, res) {
  const { user } = await authUser(req);
  limit('put:' + user.id, 400, 3600e3);
  const body = await readJson(req, 2 * 1024 * 1024);
  const incoming = sanitize(body.state);
  const out = await tx(async (c) => {
    const { rows } = await c.query('select state, category from users where id = $1 for update', [user.id]);
    if (!rows.length) throw new HttpError(401, 'Аккаунт удален', 'auth');
    const stored = stateOf(rows[0]);
    const merged = merge(stored, incoming);
    const up = await c.query(
      'update users set state = $2, version = version + 1, category = $3, updated_at = now(), last_seen_at = now() where id = $1 returning version',
      [user.id, merged, merged.profile.cat]
    );
    await applyProgress(c, user.id, stored, incoming, merged, false);
    return { version: up.rows[0].version, state: merged };
  });
  return json(res, 200, out);
}

module.exports = {
  routes: {
    'GET /api/v1/config': config,
    'POST /api/v1/auth/register': register,
    'POST /api/v1/auth/login': login,
    'POST /api/v1/auth/logout': logout,
    'POST /api/v1/auth/logout-all': logoutAll,
    'GET /api/v1/me': me,
    'PATCH /api/v1/me': patchMe,
    'DELETE /api/v1/me': deleteMe,
    'POST /api/v1/me/password': changePassword,
    'GET /api/v1/state': getState,
    'PUT /api/v1/state': putState,
    'POST /api/v1/trial': trial,
  },
  userJson, logEvent, CONSENT_VERSION,
};
