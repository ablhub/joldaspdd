'use strict';
/* Проверка и нормализация данных профиля. */
const { HttpError } = require('./util');
const { LANGS } = require('./i18n');

const CATEGORIES = ['A1', 'A', 'B1', 'B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D1', 'D', 'D1E', 'DE', 'Tb', 'Tm'];
const MIN_AGE = 14;
const ADULT = 18;

const NAME_RE = /^\p{L}(?:[\p{L}\p{M}]|['’.]|[ -](?=\p{L}))*$/u;
function titleCase(s) {
  return s.split(/([ -])/).map((w) => (w === ' ' || w === '-' ? w : w.charAt(0).toLocaleUpperCase('ru') + w.slice(1).toLocaleLowerCase('ru'))).join('');
}
function name(v, label) {
  let s = String(v == null ? '' : v).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s) throw new HttpError(400, 'Укажите ' + label);
  if (s.length > 40) throw new HttpError(400, label.charAt(0).toUpperCase() + label.slice(1) + ': не длиннее 40 символов');
  if (!NAME_RE.test(s)) throw new HttpError(400, label.charAt(0).toUpperCase() + label.slice(1) + ': только буквы, пробел, дефис и апостроф');
  if (s === s.toLocaleLowerCase('ru') || s === s.toLocaleUpperCase('ru')) s = titleCase(s);
  return s;
}

/* телефон Казахстана: +7 7XX XXX XX XX, допускаются записи с 8 и без кода */
function phone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10 && d[0] === '7') d = '7' + d;
  if (!/^77\d{9}$/.test(d)) throw new HttpError(400, 'Телефон в формате +7 7XX XXX XX XX');
  return '+' + d;
}
function phoneDigits(v) { return String(v || '').replace(/\D/g, ''); }

function todayLocal() {
  const d = new Date(Date.now() + 5 * 3600e3);   // Алматы UTC+5
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
function ageOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const t = todayLocal();
  let a = t.y - Number(m[1]);
  if (t.m < Number(m[2]) || (t.m === Number(m[2]) && t.d < Number(m[3]))) a--;
  return a;
}
function birthDate(v) {
  const s = String(v == null ? '' : v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new HttpError(400, 'Укажите дату рождения');
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dt.getUTCFullYear() !== Number(m[1]) || dt.getUTCMonth() !== Number(m[2]) - 1 || dt.getUTCDate() !== Number(m[3])) throw new HttpError(400, 'Проверьте дату рождения');
  const age = ageOf(s);
  if (age < MIN_AGE) throw new HttpError(400, 'Регистрация доступна с ' + MIN_AGE + ' лет');
  if (age > 100) throw new HttpError(400, 'Проверьте дату рождения');
  return s;
}

function category(v) {
  const s = String(v == null ? '' : v).trim();
  const c = CATEGORIES.find((x) => x.toLowerCase() === s.toLowerCase());
  if (!c) throw new HttpError(400, 'Выберите категорию');
  return c;
}

function password(v) {
  const s = String(v == null ? '' : v);
  if (s.length < 8) throw new HttpError(400, 'Пароль не короче 8 символов');
  if (s.length > 128) throw new HttpError(400, 'Пароль не длиннее 128 символов');
  if (/^(.)\1+$/.test(s)) throw new HttpError(400, 'Пароль слишком простой');
  return s;
}

/* язык интерфейса: ru, kk, en */
function lang(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!LANGS.includes(s)) throw new HttpError(400, 'Выберите язык');
  return s;
}

module.exports = { CATEGORIES, LANGS, MIN_AGE, ADULT, name, phone, phoneDigits, birthDate, category, password, lang, ageOf };
