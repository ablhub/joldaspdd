'use strict';
/* Тестовые данные для локальной проверки админки (только база joldas_dev). */
const BASE = process.argv[2] || 'http://127.0.0.1:3200';
const { execFileSync } = require('child_process');
const sql = (q) => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', 'joldas_dev', '-qAtc', q]).toString().trim();
const first = ['Айгерим', 'Нурлан', 'Дана', 'Ерлан', 'Алия', 'Тимур', 'Жанна', 'Арман', 'Мадина', 'Бауыржан', 'Сауле', 'Данияр', 'Асель', 'Руслан'];
const last = ['Серикова', 'Ахметов', 'Касымова', 'Жумабаев', 'Нуриева', 'Омаров', 'Бекова', 'Сейткали', 'Исаева', 'Тулегенов', 'Абдрахманова', 'Каримов', 'Муратова', 'Ибраев'];
const cats = ['B', 'B', 'B', 'B', 'A', 'C', 'B', 'B', 'D', 'B', 'BE', 'B', 'A1', 'C'];
const langs = ['kk', 'ru', 'kk', 'ru', 'en', 'ru', 'kk', 'ru', 'kk', 'kk', 'ru', 'en', 'ru', 'ru'];   // язык интерфейса: часть из формы, часть по X-Lang
(async () => {
  for (let i = 0; i < first.length; i++) {
    const age = 16 + ((i * 7) % 30);
    const d = new Date(); d.setFullYear(d.getFullYear() - age); d.setDate(d.getDate() - i * 3);
    const body = { firstName: first[i], lastName: last[i], birthDate: d.toISOString().slice(0, 10), category: cats[i], phone: '+7 70' + (1 + (i % 8)) + ' ' + String(1000000 + i * 7919).slice(0, 7), password: 'test-pass-' + i, pdConsent: true, marketingConsent: i % 3 !== 0, guardianConsent: age < 18, trial: i % 2 === 0 };
    if (i % 3) body.lang = langs[i];
    const r = await fetch(BASE + '/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lang': langs[i] }, body: JSON.stringify(body) });
    const j = await r.json();
    if (r.status !== 201) { console.log('reg fail', i, j); continue; }
    if (i === 3) await fetch(BASE + '/api/v1/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Lang': 'ru', Authorization: 'Bearer ' + j.token }, body: JSON.stringify({ lang: 'kk' }) });   // смена языка переключателем
    const now = Date.now(), q = {};
    for (let k = 1; k <= 20 + i * 9; k++) q['m0' + (1 + (k % 9)) + '-0' + (1 + (k % 9))] = { a: 1 + (k % 3), c: k % 4 ? 1 : 0, box: 2, due: now, t: now - k * 1000, ok: k % 4 ? 1 : 0 };
    const read = {}; for (let m = 1; m <= 1 + (i % 6); m++) read['m0' + m] = now - m * 5000;
    await fetch(BASE + '/api/v1/state', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j.token }, body: JSON.stringify({ state: { v: 1, profile: { cat: cats[i], mt: now - 100000 }, q, read, exams: [{ ts: now - i * 3600e3, n: 40, c: 24 + (i % 15), dur: 1900, wrong: [], auto: false }], days: {} } }) });
  }
  // история для графиков: регистрации, активность, экзамены и тесты гостей за 30 дней
  sql(`update users set created_at = now() - (random() * interval '29 days') where created_at > now() - interval '1 minute' and random() < 0.8`);
  sql(`insert into user_days (user_id, day, answers, correct)
       select u.id, current_date - g, (10 + random() * 60)::int, (8 + random() * 40)::int from users u, generate_series(1, 29) g
       where random() < 0.35 and u.created_at::date <= current_date - g on conflict do nothing`);
  sql(`insert into exam_results (user_id, taken_at, total, correct, category)
       select u.id, now() - (g || ' days')::interval - interval '2 hours', 40, (22 + random() * 17)::int, u.category from users u, generate_series(1, 29) g
       where random() < 0.12 on conflict do nothing`);
  sql(`insert into trial_results (at, category, total, correct, dur) select now() - (random() * interval '29 days'), 'B', 40, (15 + random() * 22)::int, 1500 from generate_series(1, 60)`);
  sql(`insert into question_stats (question_id, attempts, correct) select id, 40 + (random() * 100)::int, (random() * 40)::int from (values ('m05-03'), ('m07-02'), ('m11-04'), ('m08-01'), ('m03-06')) v(id) on conflict (question_id) do update set attempts = excluded.attempts, correct = excluded.correct`);
  sql(`update users set last_seen_at = now() - interval '3 minutes' where id in (select id from users order by random() limit 3)`);
  console.log('seeded', sql('select count(*) from users'), 'users;', sql("select string_agg(lang || ' ' || n, ', ' order by lang) from (select lang, count(*) n from users group by 1) x"));
})();
