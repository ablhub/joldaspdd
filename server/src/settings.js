'use strict';
/* Настройки площадки из админки: контакты поддержки и данные оператора персональных данных. */
const { pool } = require('./db');

const FIELDS = {
  supportText: 200,       // как связаться с поддержкой, например «WhatsApp +7 700 000 00 00»
  supportTextKk: 200,     // необязательно: тот же текст для казахской версии сайта (/kk/)
  supportTextEn: 200,     // необязательно: тот же текст для английской версии сайта (/en/)
  supportUrl: 300,        // ссылка: https://wa.me/..., https://t.me/..., mailto:...
  operatorName: 200,      // ФИО или наименование оператора (владельца сайта)
  operatorId: 20,         // ИИН или БИН
  operatorAddress: 300,   // адрес для обращений
  operatorContact: 200,   // телефон или почта для обращений по персональным данным
};
let cache = null, cacheAt = 0;

function clean(o) {
  const out = {};
  for (const k of Object.keys(FIELDS)) {
    let v = String((o && o[k]) || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FIELDS[k]);
    if (k === 'supportUrl' && v && !/^(https:\/\/|mailto:|tel:)/i.test(v)) v = '';
    if (k === 'operatorId') v = v.replace(/\D/g, '').slice(0, 12);
    out[k] = v;
  }
  return out;
}
async function getSettings() {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  let o = {};
  try {
    const { rows } = await pool.query("select value from admin_kv where key = 'settings'");
    if (rows.length) o = JSON.parse(rows[0].value);
  } catch (_) { /* пусто */ }
  cache = clean(o); cacheAt = Date.now();
  return cache;
}
async function setSettings(o) {
  const v = clean(o);
  await pool.query("insert into admin_kv (key, value) values ('settings', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify(v)]);
  cache = v; cacheAt = Date.now();
  return v;
}
module.exports = { getSettings, setSettings, FIELDS };
