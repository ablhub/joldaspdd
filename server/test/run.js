'use strict';
/* API test against a running server: BASE=http://127.0.0.1:3100 VAR=/tmp/jtest/var node test/run.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const VAR = process.env.VAR || '/tmp/jtest/var';
let cookie = '';
async function call(method, path, body, token, extra) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  if (token) h.Authorization = 'Bearer ' + token;
  if (cookie) h.Cookie = cookie;
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch (_) { j = text; }
  return { status: r.status, body: j, headers: r.headers };
}
const X = { 'X-Requested-With': 'joldas' };
const now = Date.now();
const today = new Date(now + 5 * 3600e3).toISOString().slice(0, 10);
function yearsAgo(n, extraDays) { const d = new Date(now + 5 * 3600e3); d.setUTCFullYear(d.getUTCFullYear() - n); d.setUTCDate(d.getUTCDate() - (extraDays || 0)); return d.toISOString().slice(0, 10); }
const guest = { v: 1, profile: { cat: 'B', mt: now - 5000 }, q: { 'm01-01': { a: 1, c: 1, box: 2, due: now, t: now - 4000, ok: 1 }, 'm02-01': { a: 1, c: 0, box: 0, due: now, t: now - 3000, ok: 0 } },
  exams: [{ ts: now - 3000, n: 40, c: 30, dur: 1800, wrong: [['m02-01', 2]], auto: false }], days: { [today]: { n: 40, c: 30 } }, read: {}, adone: {}, chk: {} };
const reg = (o) => Object.assign({ firstName: 'айдар', lastName: 'ТЕСТОВ', birthDate: yearsAgo(25), category: 'C', phone: '8 (701) 234-56-78', password: 'secret-pass-1', pdConsent: true, marketingConsent: true, state: guest, trial: true }, o || {});

(async () => {
  let r = await call('GET', '/api/v1/config');
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.minAge, 14);

  // validation
  r = await call('POST', '/api/v1/auth/register', reg({ pdConsent: false })); assert.strictEqual(r.status, 400, 'pd consent required');
  r = await call('POST', '/api/v1/auth/register', reg({ phone: '+7 912 000 00 00' })); assert.strictEqual(r.status, 400, 'KZ phone only');
  r = await call('POST', '/api/v1/auth/register', reg({ firstName: '<img src=x onerror=alert(1)>' })); assert.strictEqual(r.status, 400, 'html in name');
  r = await call('POST', '/api/v1/auth/register', reg({ lastName: '=cmd|calc' })); assert.strictEqual(r.status, 400, 'formula in name');
  r = await call('POST', '/api/v1/auth/register', reg({ birthDate: yearsAgo(13) })); assert.strictEqual(r.status, 400, 'too young');
  r = await call('POST', '/api/v1/auth/register', reg({ birthDate: yearsAgo(16), phone: '+77010000001' })); assert.strictEqual(r.status, 400, 'minor needs guardian');
  r = await call('POST', '/api/v1/auth/register', reg({ password: 'short' })); assert.strictEqual(r.status, 400, 'short password');
  r = await call('POST', '/api/v1/auth/register', reg({ website: 'spam' })); assert.strictEqual(r.status, 400, 'honeypot');
  r = await call('POST', '/api/v1/auth/register', reg({ category: 'Z' })); assert.strictEqual(r.status, 400, 'category');

  // register adult with guest trial progress
  r = await call('POST', '/api/v1/auth/register', reg());
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  const T1 = r.body.token, U = r.body.user;
  assert.strictEqual(U.firstName, 'Айдар'); assert.strictEqual(U.lastName, 'Тестов'); assert.strictEqual(U.phone, '+77012345678');
  assert.strictEqual(U.category, 'C'); assert.strictEqual(U.marketingConsent, true); assert.strictEqual(U.lang, 'ru', 'no lang, no X-Lang: russian');
  assert.strictEqual(r.body.state.profile.cat, 'C', 'chosen category wins'); assert.strictEqual(r.body.state.exams.length, 1, 'trial exam kept');
  r = await call('POST', '/api/v1/auth/register', reg({ phone: '+7 701 234 56 78' })); assert.strictEqual(r.status, 409, 'duplicate phone');

  // minor with guardian consent: marketing forced off
  r = await call('POST', '/api/v1/auth/register', reg({ firstName: 'Айгерим', lastName: 'Нұрланқызы', birthDate: yearsAgo(16), phone: '+77070000002', guardianConsent: true, marketingConsent: true, state: null, trial: false }));
  assert.strictEqual(r.status, 201, JSON.stringify(r.body)); assert.strictEqual(r.body.user.marketingConsent, false); assert.strictEqual(r.body.user.guardianConsent, true);
  const TM = r.body.token, UM = r.body.user;
  r = await call('PATCH', '/api/v1/me', { marketingConsent: true }, TM); assert.strictEqual(r.status, 400, 'minor cannot give marketing consent');

  // login
  r = await call('POST', '/api/v1/auth/login', { phone: '87012345678', password: 'wrong-pass' }); assert.strictEqual(r.status, 403);
  r = await call('POST', '/api/v1/auth/login', { phone: '+7 777 000 00 00', password: 'whatever1' }); assert.strictEqual(r.status, 403, 'unknown phone');
  r = await call('POST', '/api/v1/auth/login', { phone: '87012345678', password: 'secret-pass-1' }); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const T2 = r.body.token; assert.ok(r.body.state && r.body.state.exams.length === 1);

  // me + profile
  r = await call('GET', '/api/v1/me', undefined, T2); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.id, U.id);
  r = await call('PATCH', '/api/v1/me', { firstName: 'Айдархан', marketingConsent: false }, T2); assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.user.firstName, 'Айдархан'); assert.strictEqual(r.body.user.marketingConsent, false);
  r = await call('PATCH', '/api/v1/me', { marketingConsent: true }, T2); assert.strictEqual(r.body.user.marketingConsent, true);

  // progress from device 2: answers, lesson read, exam, category change
  const s2 = { v: 1, profile: { cat: 'B', mt: now + 60000 }, q: { 'm01-01': { a: 2, c: 2, box: 3, due: now, t: now + 500, ok: 1 }, 'm03-01': { a: 1, c: 1, box: 2, due: now, t: now + 600, ok: 1 } },
    read: { m03: now + 100 }, exams: [{ ts: now + 700, n: 40, c: 35, dur: 1500, wrong: [], auto: false }], days: { [today]: { n: 42, c: 32 } } };
  r = await call('PUT', '/api/v1/state', { state: s2 }, T2); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.state.profile.cat, 'B'); assert.strictEqual(r.body.state.exams.length, 2); assert.ok(r.body.state.q['m02-01']);
  r = await call('GET', '/api/v1/state', undefined, T1); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.state.exams.length, 2, 'device 1 sees merged');

  // trial (guest)
  r = await call('POST', '/api/v1/trial', { n: 40, c: 33, cat: 'B', dur: 2000 }); assert.strictEqual(r.status, 201);
  r = await call('POST', '/api/v1/trial', { n: 40, c: 41 }); assert.strictEqual(r.status, 400);

  // password change logs out other devices
  r = await call('POST', '/api/v1/me/password', { current: 'bad-current', next: 'new-secret-2' }, T2); assert.strictEqual(r.status, 403);
  r = await call('POST', '/api/v1/me/password', { current: 'secret-pass-1', next: 'new-secret-2' }, T2); assert.strictEqual(r.status, 200);
  r = await call('GET', '/api/v1/me', undefined, T1); assert.strictEqual(r.status, 401, 'other device logged out');
  r = await call('GET', '/api/v1/me', undefined, T2); assert.strictEqual(r.status, 200, 'current device kept');

  // admin
  r = await call('GET', '/admin/api/overview'); assert.strictEqual(r.status, 401);
  fs.writeFileSync(VAR + '/setup-code', 'abc123def456\n');
  r = await call('POST', '/admin/setup', { code: 'abc123def456', password: 'correct horse battery' }, null, X); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  r = await call('GET', '/admin/api/overview'); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const t = r.body.totals;
  assert.strictEqual(t.users_total, 2); assert.strictEqual(t.new_today, 2); assert.strictEqual(t.trials_total, 1); assert.strictEqual(t.marketing_yes, 1);
  assert.ok(t.answers_today >= 42, 'answers today ' + t.answers_today); assert.strictEqual(t.exams_total, 2); assert.strictEqual(t.reg_after_trial_30d, 1);
  assert.strictEqual(r.body.series.length, 30); assert.ok(r.body.series[29].reg === 2 && r.body.series[29].trials === 1, JSON.stringify(r.body.series[29]));
  assert.ok(r.body.categories.length >= 1 && r.body.ages.length >= 1); assert.strictEqual(r.body.setupMissing, true);
  assert.deepStrictEqual(r.body.langs, [{ lang: 'ru', n: 2 }], 'languages in overview');
  r = await call('GET', '/admin/api/activity'); assert.strictEqual(r.status, 200);
  const types = r.body.events.map((e) => e.type);
  for (const k of ['register', 'login', 'lesson', 'exam', 'category', 'trial', 'consent', 'profile', 'password']) assert.ok(types.includes(k), 'event ' + k + ' in ' + types.join(','));
  assert.ok(!JSON.stringify(r.body.events).includes('"ip"'), 'no ip in feed');
  assert.ok(r.body.online.length >= 1);
  r = await call('GET', '/admin/api/activity?type=exam'); assert.ok(r.body.events.every((e) => e.type === 'exam'));

  r = await call('GET', '/admin/api/users?q=' + encodeURIComponent('тестов')); assert.strictEqual(r.body.total, 1, 'search by name');
  r = await call('GET', '/admin/api/users?q=2345678'); assert.strictEqual(r.body.total, 1, 'search by phone digits');
  r = await call('GET', '/admin/api/users?q=%25'); assert.strictEqual(r.body.total, 0, 'like wildcard escaped');
  r = await call('GET', '/admin/api/users?marketing=1'); assert.strictEqual(r.body.total, 1);
  r = await call('GET', '/admin/api/users?sort=answers'); assert.strictEqual(r.body.users[0].id, U.id); assert.ok(r.body.users[0].answers >= 42);
  r = await call('GET', '/admin/api/users/' + U.id); assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.user.phone, '+77012345678'); assert.ok(r.body.consentEvidence && r.body.consentEvidence.ip, 'consent evidence'); assert.ok(r.body.exams.length === 2);
  assert.ok(r.body.stats.answers >= 42); assert.ok(r.body.events.length >= 5); assert.strictEqual(r.body.user.lessons_read, 1);

  // admin edits
  r = await call('PATCH', '/admin/api/users/' + U.id, { category: 'D' }, null); assert.strictEqual(r.status, 403, 'xhr header required');
  r = await call('PATCH', '/admin/api/users/' + U.id, { category: 'D', lastName: 'Тестов-Улы' }, null, X); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  r = await call('GET', '/api/v1/state', undefined, T2); assert.strictEqual(r.body.state.profile.cat, 'D', 'category pushed into state'); assert.strictEqual(r.body.user.lastName, 'Тестов-Улы');
  r = await call('PATCH', '/admin/api/users/' + U.id, { phone: '+77070000002' }, null, X); assert.strictEqual(r.status, 409, 'phone taken');

  // block / unblock
  r = await call('POST', '/admin/api/users/' + U.id + '/block', { reason: 'спам' }, null, X); assert.strictEqual(r.status, 200);
  r = await call('GET', '/api/v1/me', undefined, T2); assert.strictEqual(r.status, 401, 'tokens revoked on block');
  r = await call('POST', '/api/v1/auth/login', { phone: '+77012345678', password: 'new-secret-2' }); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.code, 'blocked');
  r = await call('POST', '/admin/api/users/' + U.id + '/unblock', {}, null, X); assert.strictEqual(r.status, 200);

  // reset password -> temp login -> must change
  r = await call('POST', '/admin/api/users/' + U.id + '/reset-password', {}, null, X); assert.strictEqual(r.status, 200); const tmp = r.body.tempPassword; assert.ok(/^[a-z2-9]{10}$/.test(tmp));
  r = await call('POST', '/api/v1/auth/login', { phone: '+77012345678', password: 'new-secret-2' }); assert.strictEqual(r.status, 403, 'old password invalid');
  r = await call('POST', '/api/v1/auth/login', { phone: '+77012345678', password: tmp }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.mustChangePassword, true);
  const T3 = r.body.token;
  r = await call('POST', '/api/v1/me/password', { next: 'final-secret-3' }, T3); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.mustChangePassword, false);
  r = await call('POST', '/api/v1/me/password', { next: 'final-secret-4' }, T3); assert.strictEqual(r.status, 403, 'current required after change');

  // settings -> public config
  r = await call('POST', '/admin/api/settings', { settings: { supportText: 'WhatsApp +7 700 000 00 00', supportUrl: 'javascript:alert(1)', operatorName: 'ИП Тест <b>', operatorId: '123456789012' } }, null, X);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.settings.supportUrl, '', 'unsafe url dropped'); assert.ok(!r.body.settings.operatorName.includes('<'));
  r = await call('GET', '/api/v1/config'); assert.strictEqual(r.body.support.text, 'WhatsApp +7 700 000 00 00'); assert.strictEqual(r.body.operator.id, '123456789012');

  // csv
  r = await call('GET', '/admin/api/users.csv?marketing=1');
  assert.strictEqual(r.status, 200); assert.ok(r.headers.get('content-type').includes('text/csv'));
  const raw = Buffer.from(await (await fetch(BASE + '/admin/api/users.csv?marketing=1', { headers: { Cookie: cookie } })).arrayBuffer());
  assert.ok(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, 'BOM for Excel'); assert.ok(r.body.includes('"77012345678"'), 'phone digits'); assert.ok(!r.body.includes('Айгерим'), 'filter applied');
  assert.strictEqual(r.body.trim().split('\r\n').length, 2);

  // logout-all, delete via admin, audit
  r = await call('POST', '/admin/api/users/' + UM.id + '/logout-all', {}, null, X); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.devices, 1);
  r = await call('GET', '/api/v1/me', undefined, TM); assert.strictEqual(r.status, 401);
  r = await call('DELETE', '/admin/api/users/' + UM.id, undefined, null, X); assert.strictEqual(r.status, 200);
  r = await call('GET', '/admin/api/users/' + UM.id); assert.strictEqual(r.status, 404);
  r = await call('GET', '/admin/api/audit'); const acts = r.body.audit.map((a) => a.action);
  for (const k of ['user_edit', 'user_block', 'user_unblock', 'user_reset_password', 'settings', 'export_csv', 'user_logout_all', 'user_delete']) assert.ok(acts.includes(k), 'audit ' + k);

  // user deletes own account
  r = await call('DELETE', '/api/v1/me', { password: 'wrong' }, T3); assert.strictEqual(r.status, 403);
  r = await call('DELETE', '/api/v1/me', { password: 'final-secret-3' }, T3); assert.strictEqual(r.status, 200);
  r = await call('GET', '/api/v1/me', undefined, T3); assert.strictEqual(r.status, 401);
  r = await call('GET', '/admin/api/overview'); assert.strictEqual(r.body.totals.users_total, 0); assert.strictEqual(r.body.totals.exams_total, 2, 'exam stats kept anonymously');

  // old anonymous endpoints are gone
  r = await call('POST', '/api/v1/users'); assert.strictEqual(r.status, 404);
  // admin session
  await call('POST', '/admin/logout', {}, null, X); cookie = '';
  r = await call('GET', '/admin/api/users'); assert.strictEqual(r.status, 401);
  r = await call('POST', '/admin/login', { password: 'correct horse battery' }, null, X); assert.strictEqual(r.status, 200);
  const html = await fetch(BASE + '/admin').then((x) => x.text()); assert.ok(html.includes('Жолдас'));

  // ---------- языки: ru, kk, en ----------
  // словарь сервера покрывает все сообщения для учеников (validate.js, users.js, util.js, main.js)
  const I18N = require('../src/i18n'), V = require('../src/validate');
  const msgs = new Set(['Не найдено', 'Ошибка сервера']);
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  for (const m of msgs) assert.ok(mainSrc.includes("'" + m + "'"), 'main.js message ' + m);
  for (const f of ['users.js', 'util.js', 'validate.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
    for (const m of src.matchAll(/HttpError\(\d{3}, '([^']+)'[,)]/g)) msgs.add(m[1]);
  }
  for (const f of [() => V.name('', 'имя'), () => V.name('', 'фамилию'), () => V.name('а'.repeat(41), 'имя'), () => V.name('а'.repeat(41), 'фамилию'),
    () => V.name('1', 'имя'), () => V.name('1', 'фамилию'), () => V.birthDate(yearsAgo(10))]) {
    try { f(); assert.fail('validator must throw'); } catch (e) { assert.ok(e.status === 400, e.message); msgs.add(e.message); }
  }
  assert.ok(msgs.size >= 38, 'messages found: ' + msgs.size);
  for (const m of msgs) {
    const t = I18N.DICT[m];
    assert.ok(t && t[0] && t[1], 'no kk/en translation for: ' + m);
    assert.strictEqual(I18N.tr(m, 'kk'), t[0]); assert.strictEqual(I18N.tr(m, 'en'), t[1]); assert.strictEqual(I18N.tr(m, 'ru'), m);
  }
  for (const [ru, t] of Object.entries(I18N.DICT)) {
    assert.ok(!/[\u2013\u2014]/.test(ru + t.join('')), 'long dash in ' + ru);
    assert.ok(!/[\u0400-\u04ff]/.test(t[1]), 'cyrillic in en: ' + t[1]);
  }
  assert.strictEqual(I18N.tr('Незнакомое сообщение', 'kk'), 'Незнакомое сообщение');
  assert.strictEqual(I18N.reqLang({ headers: { 'x-lang': 'KK' } }), 'kk'); assert.strictEqual(I18N.reqLang({ headers: { 'x-lang': 'en-US' } }), 'en');
  assert.strictEqual(I18N.reqLang({ headers: { 'x-lang': 'de' } }), 'ru'); assert.strictEqual(I18N.reqLang({ headers: {} }), 'ru');

  // регистрация: язык из формы важнее X-Lang
  const regL = (phone, o) => reg(Object.assign({ phone, state: null, trial: false, marketingConsent: false }, o || {}));
  r = await call('POST', '/api/v1/auth/register', regL('+77010000011', { firstName: 'Айдана', lang: 'kk' }), null, { 'X-Lang': 'en' });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body)); assert.strictEqual(r.body.user.lang, 'kk', 'lang from form');
  const TK = r.body.token, UK = r.body.user;
  // без lang: язык страницы из X-Lang
  r = await call('POST', '/api/v1/auth/register', regL('+77010000012', { firstName: 'Emily', lastName: 'Brown' }), null, { 'X-Lang': 'en' });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body)); assert.strictEqual(r.body.user.lang, 'en', 'lang from X-Lang');
  const UE = r.body.user;
  // неизвестный lang и нет X-Lang: русский
  r = await call('POST', '/api/v1/auth/register', regL('+77010000013', { firstName: 'Иван', lang: 'de' }));
  assert.strictEqual(r.status, 201, JSON.stringify(r.body)); assert.strictEqual(r.body.user.lang, 'ru', 'unknown lang: russian');
  const UR = r.body.user;
  // ошибки регистрации на языке страницы
  r = await call('POST', '/api/v1/auth/register', regL('+77010000014', { password: 'short', lang: 'kk' }), null, { 'X-Lang': 'kk' });
  assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Құпиясөз кемінде 8 таңбадан тұруы керек');
  r = await call('POST', '/api/v1/auth/register', regL('+7 701 000 00 11', { lang: 'en' }), null, { 'X-Lang': 'en' });
  assert.strictEqual(r.status, 409); assert.strictEqual(r.body.error, 'This number is already registered. Log in with your number and password'); assert.strictEqual(r.body.code, 'phone_taken');
  // язык в базе, в событии регистрации и в /me
  r = await call('GET', '/admin/api/users/' + UK.id); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.lang, 'kk');
  assert.strictEqual(r.body.events.find((e) => e.type === 'register').data.lang, 'kk', 'lang in register event');
  r = await call('GET', '/api/v1/me', undefined, TK); assert.strictEqual(r.body.user.lang, 'kk');

  // PATCH /me {lang}: сохраняет язык и пишет событие profile
  r = await call('PATCH', '/api/v1/me', { lang: 'en' }, TK, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(r.body.user.lang, 'en');
  r = await call('GET', '/admin/api/activity?type=profile');
  let pev = r.body.events.filter((e) => e.user_id === UK.id);
  assert.strictEqual(pev.length, 1); assert.deepStrictEqual(pev[0].data.fields, ['lang']); assert.strictEqual(pev[0].data.lang, 'en');
  r = await call('PATCH', '/api/v1/me', { lang: 'en' }, TK); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.lang, 'en');
  r = await call('GET', '/admin/api/activity?type=profile'); assert.strictEqual(r.body.events.filter((e) => e.user_id === UK.id).length, 1, 'same lang: no event');
  // неверный lang: 400, сообщение на языке страницы, язык не меняется
  r = await call('PATCH', '/api/v1/me', { lang: 'de' }, TK); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Выберите язык');
  r = await call('PATCH', '/api/v1/me', { lang: 'de', firstName: 'Айдана' }, TK, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Тілді таңдаңыз');
  r = await call('PATCH', '/api/v1/me', { lang: ['kk'] }, TK, { 'X-Lang': 'en' }); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Choose a language');
  r = await call('PATCH', '/api/v1/me', { lang: null }, TK); assert.strictEqual(r.status, 400);
  r = await call('GET', '/api/v1/me', undefined, TK); assert.strictEqual(r.body.user.lang, 'en', 'invalid lang ignored');
  r = await call('PATCH', '/api/v1/me', { lang: 'kk' }, TK, { 'X-Lang': 'en' }); assert.strictEqual(r.body.user.lang, 'kk', 'back to kk');

  // ошибка входа на языке страницы
  const bad = { phone: '+77010000099', password: 'wrong-pass-1' };
  r = await call('POST', '/api/v1/auth/login', bad); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.error, 'Неверный телефон или пароль'); assert.strictEqual(r.body.code, 'bad_credentials');
  r = await call('POST', '/api/v1/auth/login', bad, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.error, 'Телефон немесе құпиясөз қате'); assert.strictEqual(r.body.code, 'bad_credentials');
  r = await call('POST', '/api/v1/auth/login', bad, null, { 'X-Lang': 'en' }); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.error, 'Wrong phone number or password');
  r = await call('POST', '/api/v1/auth/login', bad, null, { 'X-Lang': 'fr' }); assert.strictEqual(r.body.error, 'Неверный телефон или пароль', 'unknown X-Lang: russian');
  r = await call('POST', '/api/v1/auth/login', { phone: '+77010000012', password: 'secret-pass-1' }, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.lang, 'en', 'login keeps saved lang');
  // другие ответы: проверка полей, вход, 404, JSON
  r = await call('PATCH', '/api/v1/me', { firstName: '' }, TK, { 'X-Lang': 'kk' }); assert.strictEqual(r.body.error, 'Атыңызды жазыңыз');
  r = await call('PATCH', '/api/v1/me', { lastName: 'ы'.repeat(41) }, TK, { 'X-Lang': 'en' }); assert.strictEqual(r.body.error, 'Last name: 40 characters maximum');
  r = await call('GET', '/api/v1/me', undefined, null, { 'X-Lang': 'en' }); assert.strictEqual(r.status, 401); assert.strictEqual(r.body.error, 'Please log in');
  r = await call('GET', '/api/v1/state', undefined, 'x'.repeat(43), { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 401); assert.strictEqual(r.body.error, 'Сеанс аяқталды, қайта кіріңіз');
  r = await call('GET', '/api/v1/nope', undefined, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 404); assert.strictEqual(r.body.error, 'Табылмады');
  r = await call('GET', '/api/v1/nope', undefined, null, { 'X-Lang': 'en' }); assert.strictEqual(r.body.error, 'Not found');
  r = await call('POST', '/api/v1/trial', Buffer.from('{bad'), null, { 'X-Lang': 'en' }); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Invalid JSON');
  r = await call('POST', '/api/v1/trial', { n: 99 }, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'Нәтиже қате');
  // админка отвечает по-русски даже с X-Lang
  r = await call('PATCH', '/admin/api/users/' + UK.id, { category: 'D' }, null, { 'X-Lang': 'en' }); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.error, 'Запрос отклонен');
  r = await call('GET', '/admin/api/nope', undefined, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.status, 404); assert.strictEqual(r.body.error, 'Не найдено');
  // страницы языков в режиме разработки (PUBLIC_DIR): каталог без расширения отдает <каталог>/index.html
  if (process.env.PUBLIC_DIR) {
    for (const [p, lang] of [['/', 'ru'], ['/index.html', 'ru'], ['/kk', 'kk'], ['/kk/', 'kk'], ['/kk/index.html', 'kk'], ['/en', 'en'], ['/en/', 'en'], ['/en/index.html', 'en']]) {
      const x = await fetch(BASE + p); const t = await x.text();
      assert.strictEqual(x.status, 200, 'page ' + p); assert.ok(t.includes('<html lang="' + lang + '"'), 'page ' + p + ' is ' + lang);
      assert.ok((x.headers.get('content-type') || '').startsWith('text/html'), 'html type ' + p);
    }
    for (const p of ['/de', '/de/', '/kk/nope', '/..%2f..%2fetc%2fpasswd']) { const x = await fetch(BASE + p); assert.ok(x.status === 404 || x.status === 403, 'no page ' + p + ': ' + x.status); }
  }

  // текст поддержки на языке страницы
  r = await call('POST', '/admin/api/settings', { settings: { supportText: 'WhatsApp +7 700 000 00 00', supportTextKk: 'WhatsApp +7 700 000 00 00, қазақша <b>', supportUrl: 'https://wa.me/77000000000', operatorName: 'ИП Тест', operatorId: '123456789012' } }, null, X);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.settings.supportTextKk, 'WhatsApp +7 700 000 00 00, қазақша b', 'kk text cleaned'); assert.strictEqual(r.body.settings.supportTextEn, '');
  r = await call('GET', '/api/v1/config', undefined, null, { 'X-Lang': 'kk' }); assert.strictEqual(r.body.support.text, 'WhatsApp +7 700 000 00 00, қазақша b'); assert.strictEqual(r.body.support.url, 'https://wa.me/77000000000');
  assert.ok(/x-lang/i.test(r.headers.get('vary') || ''), 'Vary: X-Lang');
  r = await call('GET', '/api/v1/config', undefined, null, { 'X-Lang': 'en' }); assert.strictEqual(r.body.support.text, 'WhatsApp +7 700 000 00 00', 'no en text: russian');
  r = await call('GET', '/api/v1/config'); assert.strictEqual(r.body.support.text, 'WhatsApp +7 700 000 00 00');
  r = await call('POST', '/admin/api/settings', { settings: { supportText: 'WhatsApp +7 700 000 00 00', supportTextKk: 'WhatsApp, қазақша', supportTextEn: 'WhatsApp, English ' + 'x'.repeat(300), operatorName: 'ИП Тест' } }, null, X);
  assert.strictEqual(r.body.settings.supportTextEn.length, 200, 'en text length limited like supportText');
  r = await call('GET', '/api/v1/config', undefined, null, { 'X-Lang': 'en' }); assert.ok(r.body.support.text.startsWith('WhatsApp, English'));
  r = await call('GET', '/admin/api/settings'); assert.strictEqual(r.body.settings.supportTextKk, 'WhatsApp, қазақша');

  // админка: фильтр по языку, колонка CSV, обзор
  r = await call('GET', '/admin/api/users?lang=kk'); assert.strictEqual(r.body.total, 1); assert.strictEqual(r.body.users[0].id, UK.id); assert.strictEqual(r.body.users[0].lang, 'kk');
  r = await call('GET', '/admin/api/users?lang=en'); assert.strictEqual(r.body.total, 1); assert.strictEqual(r.body.users[0].id, UE.id);
  r = await call('GET', '/admin/api/users?lang=ru'); assert.strictEqual(r.body.total, 1); assert.strictEqual(r.body.users[0].id, UR.id);
  r = await call('GET', '/admin/api/users?lang=de'); assert.strictEqual(r.body.total, 3, 'unknown lang filter ignored');
  r = await call('GET', '/admin/api/users?lang=kk&cat=B'); assert.strictEqual(r.body.total, 0, 'lang combined with other filters');
  r = await call('GET', '/admin/api/users.csv?lang=kk'); assert.strictEqual(r.status, 200);
  let rows = r.body.replace(/^\ufeff/, '').trim().split('\r\n').map((l) => l.split(';').map((c) => c.replace(/^"|"$/g, '')));
  const li = rows[0].indexOf('Язык интерфейса'); assert.ok(li > 0, 'csv column: ' + rows[0].join(','));
  assert.strictEqual(rows.length, 2); assert.strictEqual(rows[1][li], 'казахский'); assert.strictEqual(rows[1][1], 'Айдана');
  r = await call('GET', '/admin/api/users.csv');
  rows = r.body.replace(/^\ufeff/, '').trim().split('\r\n').map((l) => l.split(';').map((c) => c.replace(/^"|"$/g, '')));
  assert.deepStrictEqual(rows.slice(1).map((x) => x[li]).sort(), ['английский', 'казахский', 'русский']);
  r = await call('GET', '/admin/api/audit'); assert.ok(r.body.audit.some((a) => a.action === 'export_csv' && a.data.filters && a.data.filters.lang === 'kk'), 'csv audit keeps lang filter');
  r = await call('GET', '/admin/api/overview'); assert.strictEqual(r.status, 200);
  const langs = Object.fromEntries(r.body.langs.map((x) => [x.lang, x.n]));
  assert.deepStrictEqual(langs, { ru: 1, kk: 1, en: 1 }, 'overview langs');
  // --- обновление с GitHub (поддельный GitHub на порту GITHUB_PORT, адрес задан серверу через GITHUB_BASE) ---
  const http = require('http'), crypto = require('crypto');
  const signed = Buffer.concat([Buffer.from('JSIG', 'latin1'), Buffer.alloc(64, 7), Buffer.from([0x1f, 0x8b]), Buffer.alloc(2000, 1)]);
  const gh = http.createServer((q, s) => {
    if (q.url === '/own/repo/releases/latest/download/joldas-release.signed') { s.writeHead(302, { Location: '/dl/rel.bin' }); return s.end(); }
    const TAG = 'v2099.01.01-0000-abcdef0';
    if (q.url === '/own/repo/releases/latest') { s.writeHead(302, { Location: '/own/repo/releases/tag/' + TAG }); return s.end(); }
    if (q.url === '/own/repo/releases/download/' + TAG + '/joldas-release.signed') { s.writeHead(302, { Location: '/dl/rel.bin' }); return s.end(); }
    if (q.url === '/old/repo/releases/latest') { s.writeHead(302, { Location: '/old/repo/releases/tag/v2000.01.01-0000-abcdef0' }); return s.end(); }
    if (q.url === '/odd/repo/releases/latest') { s.writeHead(302, { Location: '/odd/repo/releases/tag/beta-1' }); return s.end(); }
    if (q.url === '/none/repo/releases/latest') { s.writeHead(302, { Location: '/none/repo/releases' }); return s.end(); }
    if (q.url === '/dl/rel.bin') { s.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return s.end(signed); }
    if (q.url === '/bad/html/releases/latest/download/joldas-release.signed') { s.writeHead(200); return s.end('<html>not a release</html>'); }
    s.writeHead(404); s.end('no');
  });
  await new Promise((ok) => gh.listen(Number(process.env.GITHUB_PORT || 3199), '127.0.0.1', ok));
  try {
    const before = fs.existsSync(path.join(VAR, 'incoming')) ? fs.readdirSync(path.join(VAR, 'incoming')).length : 0;
    r = await call('POST', '/admin/api/deploy-github', { repo: 'own/repo' }, null, X);
    assert.strictEqual(r.status, 202, JSON.stringify(r.body));
    assert.strictEqual(r.body.sha256, crypto.createHash('sha256').update(signed).digest('hex'), 'github: контрольная сумма');
    const inc = fs.readdirSync(path.join(VAR, 'incoming')).filter((n) => n.endsWith('.signed'));
    assert.strictEqual(inc.length, before + 1, 'github: архив поставлен в очередь установки');
    assert.ok(fs.readFileSync(path.join(VAR, 'incoming', r.body.queued)).equals(signed), 'github: файл совпадает с релизом (после перенаправления)');
    r = await call('POST', '/admin/api/deploy-github', { repo: 'nobody/none' }, null, X);
    assert.strictEqual(r.status, 404); assert.ok(/нет опубликованного релиза/.test(r.body.error), 'github: понятная ошибка, когда релиза нет');
    r = await call('POST', '/admin/api/deploy-github', { repo: 'bad/html' }, null, X);
    assert.strictEqual(r.status, 400); assert.ok(/подписанный архив/.test(r.body.error), 'github: чужой файл без подписи отклонен');
    for (const bad of ['../etc', 'a/b/c', 'one', 'a b/c', 'x/y?z=1', '']) {
      if (bad === '') continue;
      r = await call('POST', '/admin/api/deploy-github', { repo: bad }, null, X);
      assert.strictEqual(r.status, 400, 'github: имя репозитория ' + bad);
    }
    r = await call('POST', '/admin/api/deploy-github', { repo: 'own/repo' });
    assert.ok(r.status >= 400, 'github: без заголовка защиты запрос отклонен');
    r = await call('GET', '/admin/api/deploy-status'); assert.strictEqual(r.body.githubRepo, 'ablhub/joldaspdd');
    r = await call('GET', '/admin/api/audit'); assert.ok(r.body.audit.some((a) => a.action === 'deploy' && a.data && a.data.source === 'github' && a.data.repo === 'own/repo'), 'github: запись в журнале');
    // --- автообновление: сервер сам проверяет последний релиз ---
    const inDir = path.join(VAR, 'incoming');
    const clearQueue = () => { for (const n of fs.readdirSync(inDir)) if (n.endsWith('.signed')) fs.unlinkSync(path.join(inDir, n)); };
    clearQueue();
    r = await call('GET', '/admin/api/auto-update');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.enabled, false, 'auto: по умолчанию выключено из-за AUTO_UPDATE=0'); assert.strictEqual(r.body.version, '2026.09.30-1807-67b52af');
    r = await call('POST', '/admin/api/auto-update', { enabled: true });
    assert.ok(r.status >= 400, 'auto: без заголовка защиты отклонено');
    r = await call('POST', '/admin/api/auto-update', { repo: '../etc' }, null, X); assert.strictEqual(r.status, 400, 'auto: плохое имя репозитория');
    r = await call('POST', '/admin/api/auto-update', { enabled: true, repo: 'own/repo' }, null, X);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.enabled, true); assert.strictEqual(r.body.repo, 'own/repo');
    r = await call('POST', '/admin/api/auto-update', { check: true }, null, X);
    assert.strictEqual(r.body.lastResult, 'queued', 'auto: новая версия поставлена в очередь: ' + JSON.stringify(r.body)); assert.strictEqual(r.body.lastTag, 'v2099.01.01-0000-abcdef0');
    let q = fs.readdirSync(inDir).filter((n) => n.endsWith('.signed'));
    assert.strictEqual(q.length, 1, 'auto: один файл в очереди'); assert.ok(fs.readFileSync(path.join(inDir, q[0])).equals(signed), 'auto: файл совпадает с релизом');
    r = await call('POST', '/admin/api/auto-update', { check: true }, null, X);
    assert.strictEqual(r.body.lastResult, 'busy', 'auto: пока идет установка, второй раз не ставим');
    assert.strictEqual(fs.readdirSync(inDir).filter((n) => n.endsWith('.signed')).length, 1);
    clearQueue();
    for (const [repo, want] of [['old/repo', 'up-to-date'], ['odd/repo', 'skip'], ['none/repo', 'no-release'], ['nobody/none', 'no-release']]) {
      r = await call('POST', '/admin/api/auto-update', { repo, check: true }, null, X);
      assert.strictEqual(r.body.lastResult, want, 'auto: ' + repo + ' -> ' + JSON.stringify(r.body));
      assert.strictEqual(fs.readdirSync(inDir).filter((n) => n.endsWith('.signed')).length, 0, 'auto: ' + repo + ' ничего не ставит');
    }
    r = await call('POST', '/admin/api/auto-update', { repo: 'own/repo', enabled: false }, null, X); assert.strictEqual(r.body.enabled, false);
    r = await call('GET', '/admin/api/audit');
    assert.ok(r.body.audit.some((a) => a.action === 'auto_update'), 'auto: настройка в журнале');
    assert.ok(r.body.audit.some((a) => a.action === 'deploy' && a.data && a.data.source === 'github-auto' && a.data.tag === 'v2099.01.01-0000-abcdef0'), 'auto: установка в журнале');
    clearQueue();
  } finally { gh.close(); }
  console.log('API TESTS OK');
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
