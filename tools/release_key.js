'use strict';
/* Чтение секретного ключа подписи релизов (Ed25519) из текста секрета GitHub.
   Принимает обычный PEM и его частые искажения при вставке в веб-форму: отступы, пробелы вместо переводов строк,
   CRLF, литеральные "\n", кавычки, а также ключ одной строкой в base64 (DER или весь PEM в base64).
   Содержимое секрета в сообщениях об ошибках не показывается.
   Проверка в CI:  KEY="$секрет" node tools/release_key.js --check   (печатает публичный ключ: он не секретный и должен совпасть с ключом на сервере) */
const crypto = require('crypto');

const PKCS8_SEED_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function fail(msg) { throw new Error('RELEASE_SIGNING_KEY: ' + msg); }

function fromDer(der) {
  let key;
  try { key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }); } catch (_) { fail('в секрете не закрытый ключ формата PKCS8 (ожидается файл release.key целиком)'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('ключ не Ed25519 (тип ' + key.asymmetricKeyType + ')');
  return key;
}

function loadPrivateKey(raw) {
  let t = String(raw == null ? '' : raw).trim();
  if (!t) fail('секрет пустой');
  t = t.replace(/^["']+|["']+$/g, '').replace(/\\r\\n|\\n|\\r/g, '\n').trim();
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([^]*?)(?:-----END [A-Z0-9 ]+-----|$)/.exec(t);
  if (m) {
    const label = m[1].trim();
    if (/PUBLIC/.test(label)) fail('в секрете публичный ключ (release.pub); нужен секретный ключ из файла release.key');
    if (label !== 'PRIVATE KEY') fail('неподдерживаемый формат "' + label + '", нужен PRIVATE KEY (PKCS8)');
    const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
    if (!body) fail('между строками BEGIN и END пусто');
    let der;
    try { der = Buffer.from(body, 'base64'); } catch (_) { fail('тело ключа не base64'); }
    if (der.length !== 48) {
      let other = null; try { other = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }); } catch (_) { /* не читается: значит обрезан */ }
      if (other && other.asymmetricKeyType !== 'ed25519') fail('ключ не Ed25519 (тип ' + other.asymmetricKeyType + ')');
    }
    if (der.length !== 48) fail('тело ключа неполное или лишнее (' + der.length + ' байт вместо 48): скопируйте файл release.key целиком, от BEGIN до END');
    return fromDer(der);
  }
  // без строк BEGIN/END: base64 одной строкой (DER или целый PEM) или 32 байта seed
  const b64 = t.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=_-]+$/.test(b64)) fail('не похоже на ключ: нет строки BEGIN PRIVATE KEY и это не base64');
  const buf = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (buf.slice(0, 5).toString() === '-----') return loadPrivateKey(buf.toString('utf8'));
  if (buf.length === 32) return fromDer(Buffer.concat([PKCS8_SEED_PREFIX, buf]));
  if (buf.length === 48) return fromDer(buf);
  fail('не похоже на закрытый ключ Ed25519 (после декодирования ' + buf.length + ' байт)');
}

function publicB64(key) { return crypto.createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64'); }

module.exports = { loadPrivateKey, publicB64 };

if (require.main === module && process.argv[2] === '--check') {
  try {
    const key = loadPrivateKey(process.env.KEY);
    const raw = String(process.env.KEY);
    console.log('Ключ подписи читается (Ed25519). Публичный ключ: ' + publicB64(key));
    console.log('Форма секрета: ' + raw.length + ' символов, ' + raw.trim().split(/\r?\n/).length + ' строк' + (/-----BEGIN PRIVATE KEY-----\r?\n/.test(raw) ? '' : ' (нестандартная форма, прочитана после исправления)'));
  } catch (e) {
    console.log('::error::' + e.message + '. Как исправить: docs/DEPLOY.md, раздел «Один раз: настройка»');
    process.exit(1);
  }
}
