'use strict';
/* Проверка распознавания знаков в тексте (картинки знаков в учебнике, вопросах и экзамене).
   Запуск: node tools/signs_test.js [--show N]   Берет собранные данные site/public/assets/data.<язык>.*.json
   Код распознавания берется прямо из src/app.js (блок между метками), поэтому тест проверяет то, что работает на сайте. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), ADIR = path.join(ROOT, 'site', 'public', 'assets');
const show = process.argv.includes('--show') ? +process.argv[process.argv.indexOf('--show') + 1] || 30 : 0;
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const a = app.indexOf('/* ---------- картинки знаков рядом с текстом'), b = app.indexOf('function signThumbs');
if (a < 0 || b < 0) throw new Error('в src/app.js не найден блок распознавания знаков');
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const texts = (d) => {
  const out = [];
  for (const m of d.modules) {
    const dm = m.id === 'm19' ? 'm' : 's';
    const add = (t, where) => { if (typeof t === 'string') out.push([t, dm, m.id + ' ' + where]); };
    for (const l of m.lesson) { add(l.h, 'h'); (l.p || []).forEach((x) => add(x, 'p')); (l.list || []).forEach((x) => add(x, 'li')); add(l.tip, 'tip'); }
    (m.keyFacts || []).forEach((x) => add(x, 'key')); (m.mistakes || []).forEach((x) => add(x, 'err'));
    for (const q of m.questions) { add(q.q, q.id + ' q'); q.options.forEach((o) => add(o, q.id + ' opt')); add(q.explain, q.id + ' exp'); }
  }
  return out;
};
const res = {};
for (const lang of ['ru', 'kk', 'en']) {
  const f = fs.readdirSync(ADIR).find((n) => new RegExp('^data\\.' + lang + '\\.[0-9a-f]{8}\\.json$').test(n));
  const L = fs.readFileSync(path.join(ADIR, f), 'utf8').split('\n');
  const D = JSON.parse(L[0]); D.modules = L.slice(1).filter(Boolean).map((x) => JSON.parse(x));
  const env = { SIGNS: D.signs, SIGN: {}, esc: (s) => String(s) };
  D.signs.forEach((s) => { env.SIGN[s.code] = s; });
  vm.createContext(env);
  vm.runInContext(app.slice(a, b) + '\nthis.findSigns=findSigns;', env);
  let n = 0, hit = 0, codes = 0; const samples = [], byCode = {};
  for (const [t, dm, where] of texts(D)) {
    n++;
    const r = env.findSigns(t, dm);
    if (r.length) { hit++; codes += r.length; r.forEach((c) => { byCode[c] = (byCode[c] || 0) + 1; }); if (samples.length < 4000) samples.push([where, r.join(','), t]); }
  }
  res[lang] = { n, hit, codes, samples, byCode };
  check(hit > 500, lang + ': тексты с найденными знаками: ' + hit + ' из ' + n + ' (знаков всего ' + codes + ', разных ' + Object.keys(byCode).length + ')');
  // эталонные случаи
  const T = (t, dm) => env.findSigns(t, dm || 's').join(',');
  if (lang === 'ru') {
    check(T('Вы проезжаете знак 3.1 и знаки 5.8.1, 5.8.2.') === '3.1,5.8.1,5.8.2', 'ru: номера после слова знак');
    check(T('Знаки 2.4-2.6 требуют уступить дорогу') === '2.4,2.5,2.6', 'ru: диапазон 2.4-2.6');
    check(T('Двойная сплошная - это разметка 1.3. Линии 1.1, 1.2 и 1.3 пересекать запрещается') === '', 'ru: разметка 1.x не считается знаком');
    check(T('на перекрестке (разметка 1.18, знаки 5.8.1, 5.8.2).') === '5.8.1,5.8.2', 'ru: разметка, затем знаки в одном предложении');
    check(T('Высота 4.5 м и масса 3.5 т') === '', 'ru: величины с единицами не считаются знаками');
    check(T('Вы проезжаете знак «Дети» у школы.') === '1.21', 'ru: знак по названию в кавычках');
    check(T('Согласно п. 3.1 Правил') === '', 'ru: ссылка на пункт');
    check(T('Стрелы и островки: 1.16, 1.18, 1.19', 'm') === '', 'ru: тема про разметку, номера без слова знак');
    check(T('Вы на грузовике проехали знак 3.22. Впереди знак 3.24 «60».') === '3.22,3.24', 'ru: знак с числом в кавычках');
  }
  if (lang === 'en') {
    check(T('You pass sign 3.1 and signs 5.8.1, 5.8.2.') === '3.1,5.8.1,5.8.2', 'en: numbers after the word sign');
    check(T('The double solid line is marking 1.3; lines 1.1 and 1.2 may not be crossed') === '', 'en: marking numbers are not signs');
    check(T('The design is 2.4 m wide') === '', 'en: word design and a measurement');
  }
  if (lang === 'kk') {
    check(T('Сіз 3.1 белгісінен өтесіз, 5.8.1 және 5.8.2 белгілері') !== '', 'kk: номера рядом со словом белгі');
  }
}
if (show) {
  const r = res.ru.samples; const step = Math.max(1, Math.floor(r.length / show));
  console.log('--- примеры (ru), каждый ' + step + '-й ---');
  for (let i = 0; i < r.length; i += step) console.log(r[i][1].padEnd(18), r[i][0].padEnd(14), r[i][2].slice(0, 140).replace(/\n/g, ' '));
}
fs.writeFileSync(path.join(process.env.SIGNS_REPORT || '/tmp/signs-report.json'), JSON.stringify({ ru: res.ru.samples, kk: res.kk.samples, en: res.en.samples }));
console.log('FAILS', fails); process.exit(fails ? 1 : 0);
