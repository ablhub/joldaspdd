'use strict';
/* Сборка релиза для сервера Жолдас:
   - site/public (сборка сайта с синхронизацией) + server/ + server/deploy -> release/
   - out/joldas-release.tgz (для обновления через админку)
   - out/joldas-release.signed (для первой установки: заголовок JSIG + подпись Ed25519 + tgz)
   - out/joldas-cloud-init.yaml (данные пользователя для создания сервера: публичный ключ, загрузчик, скрипт настройки)
   Использование: node tools/build_release.js [outdir]
   Ключ подписи (Ed25519): переменная RELEASE_KEY_PEM (содержимое секретного ключа, для CI) или файлы release.key и release.pub в каталоге JOLDAS_KEYDIR
   (по умолчанию ~/.joldas-release-key; если там пусто, создается новая пара). В CI без ключа собирается только release.tgz, без подписи. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'release-out'));
const KEYDIR = process.env.JOLDAS_KEYDIR || path.join(os.homedir(), '.joldas-release-key');
const TMP = path.join(os.tmpdir(), 'joldas-release-build');

// 1. ключ подписи релизов (секретная часть хранится только у владельца: в секретах GitHub или в защищенном каталоге)
let priv = null, pubPem = null;
if (process.env.RELEASE_KEY_PEM) {
  priv = crypto.createPrivateKey(process.env.RELEASE_KEY_PEM);
  pubPem = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' });
} else {
  const keyFile = path.join(KEYDIR, 'release.key'), pubFile = path.join(KEYDIR, 'release.pub');
  if (!fs.existsSync(keyFile) && !process.env.CI) {
    fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(pubFile, publicKey.export({ type: 'spki', format: 'pem' }));
  }
  if (fs.existsSync(keyFile)) { priv = crypto.createPrivateKey(fs.readFileSync(keyFile)); pubPem = fs.readFileSync(pubFile, 'utf8'); }
}
if (!priv) console.log('ключа подписи нет (CI без RELEASE_KEY_PEM): соберу только release.tgz без подписи');

// 2. сайт с синхронизацией на трех языках: public/index.html (ru), public/kk/index.html, public/en/index.html
execFileSync('python3', [path.join(ROOT, 'build.py'), '--verified', '--api', '--lang', 'all', '--strict'], { stdio: 'inherit' });
// готовый первый экран гостя в HTML (быстрый показ на слабых телефонах), см. tools/prerender.py
execFileSync('python3', [path.join(ROOT, 'tools', 'prerender.py')], { stdio: 'inherit' });
const PAGES = ['index.html', 'kk/index.html', 'en/index.html'];

// 3. сборка каталога release/ (site/public копируется целиком, вместе с kk/ и en/)
fs.rmSync(TMP, { recursive: true, force: true });
const REL = path.join(TMP, 'release');
fs.mkdirSync(REL, { recursive: true });
fs.cpSync(path.join(ROOT, 'site', 'public'), path.join(REL, 'public'), { recursive: true });
for (const f of PAGES.concat(['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'manifest.webmanifest', '404.html', 'assets/seo.css', 'signs/index.html', 'kk/signs/index.html', 'en/faq/index.html'])) if (!fs.existsSync(path.join(REL, 'public', f))) throw new Error('в релизе нет public/' + f);
// 3a. файлы страницы на трех языках (код, схемы, данные с отпечатком в имени), индекс вопросов и шрифты обязательны
const adir = path.join(REL, 'public', 'assets');
for (const l of ['ru', 'kk', 'en']) for (const [k, ext] of [['app', 'js'], ['scene', 'js'], ['data', 'json']]) {
  const re = new RegExp('^' + k + '\\.' + l + '\\.[0-9a-f]{8}\\.' + ext + '$');
  if (fs.readdirSync(adir).filter((n) => re.test(n)).length !== 1) throw new Error('в релизе должен быть ровно один файл assets/' + k + '.' + l + '.<отпечаток>.' + ext);
}
for (const f of PAGES) {
  const h = fs.readFileSync(path.join(REL, 'public', f), 'utf8');
  if (!/<!--pre:app-->[^]*class="hero[^]*<!--\/pre:app-->/.test(h) || !/<!--pre:nav-->[^]*data-go=[^]*<!--\/pre:nav-->/.test(h)) throw new Error('в ' + f + ' нет готового первого экрана (tools/prerender.py)');
}
for (const f of ['qindex.json', 'fonts/golos-text-latin-wght-normal.woff2', 'fonts/golos-text-cyrillic-wght-normal.woff2']) if (!fs.existsSync(path.join(adir, f))) throw new Error('в релизе нет public/assets/' + f);
// 3b. сжатые копии .br и .gz для текстовых файлов: сервер отдает их без сжатия на лету (быстрее первый байт, меньше трафика)
let nz = 0, zin = 0, zbr = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!/\.(html|js|css|json|svg|xml|txt|webmanifest)$/.test(e.name)) continue;
    const buf = fs.readFileSync(f);
    if (buf.length < 600) continue;
    const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
    const gz = zlib.gzipSync(buf, { level: 9 });
    if (br.length < buf.length * 0.95) { fs.writeFileSync(f + '.br', br); zin += buf.length; zbr += br.length; nz++; }
    if (gz.length < buf.length * 0.95) fs.writeFileSync(f + '.gz', gz);
  }
})(path.join(REL, 'public'));
console.log('сжатые копии: ' + nz + ' файлов, ' + Math.round(zin / 1024) + ' КБ -> ' + Math.round(zbr / 1024) + ' КБ (brotli)');
fs.mkdirSync(path.join(REL, 'server'));
for (const x of ['src', 'migrations', 'node_modules', 'package.json']) fs.cpSync(path.join(ROOT, 'server', x), path.join(REL, 'server', x), { recursive: true });
fs.cpSync(path.join(ROOT, 'server', 'deploy'), path.join(REL, 'deploy'), { recursive: true });
const pagesHash = crypto.createHash('sha256');
for (const f of PAGES) pagesHash.update(fs.readFileSync(path.join(REL, 'public', f)));
for (const n of fs.readdirSync(adir).filter((x) => /^(app|scene|data)\.[a-z]+\.[0-9a-f]{8}\.(js|json)$/.test(x)).sort()) pagesHash.update(n);
const d = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const version = d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '-' + pagesHash.digest('hex').slice(0, 7);
fs.writeFileSync(path.join(REL, 'VERSION'), version + '\n');

// 4. архивы
fs.mkdirSync(OUT, { recursive: true });
const tgzPath = path.join(OUT, 'joldas-release.tgz');
execFileSync('tar', ['-czf', tgzPath, '--owner=0', '--group=0', '-C', TMP, 'release']);
const tgz = fs.readFileSync(tgzPath);
if (priv) {
  const sig = crypto.sign(null, tgz, priv);
  if (sig.length !== 64) throw new Error('unexpected signature length');
  fs.writeFileSync(path.join(OUT, 'joldas-release.signed'), Buffer.concat([Buffer.from('JSIG', 'latin1'), sig, tgz]));
}

// 5. cloud-init
const ind = (text, n) => text.replace(/\n$/, '').split('\n').map((l) => (l.length ? ' '.repeat(n) + l : '')).join('\n');
const receiver = fs.readFileSync(path.join(ROOT, 'server', 'deploy', 'receiver.js'), 'utf8');
const provision = fs.readFileSync(path.join(ROOT, 'server', 'deploy', 'provision.sh'), 'utf8');
const unit = ['[Unit]', 'Description=Joldas first release receiver', 'After=network-online.target', '', '[Service]', 'ExecStart=/usr/bin/env node /opt/joldas-bootstrap/receiver.js', 'Restart=on-failure', 'RestartSec=3', '', '[Install]', 'WantedBy=multi-user.target', ''].join('\n');
const yaml = [
  '#cloud-config',
  '# Жолдас ПДД: автонастройка сервера. Секретов здесь нет: только публичный ключ проверки релизов.',
  'timezone: Asia/Almaty',
  'write_files:',
  '  - path: /opt/joldas-bootstrap/release.pub',
  "    permissions: '0644'",
  '    content: |',
  ind(pubPem || '', 6),
  '  - path: /opt/joldas-bootstrap/receiver.js',
  "    permissions: '0644'",
  '    content: |',
  ind(receiver, 6),
  '  - path: /opt/joldas-bootstrap/provision.sh',
  "    permissions: '0755'",
  '    content: |',
  ind(provision, 6),
  '  - path: /etc/systemd/system/joldas-bootstrap.service',
  "    permissions: '0644'",
  '    content: |',
  ind(unit, 6),
  'runcmd:',
  '  - [bash, /opt/joldas-bootstrap/provision.sh]',
  '',
].join('\n');
if (priv) fs.writeFileSync(path.join(OUT, 'joldas-cloud-init.yaml'), yaml);

const sz = (f) => (fs.existsSync(path.join(OUT, f)) ? Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB' : '-');
const inTgz = execFileSync('tar', ['-tzf', tgzPath], { encoding: 'utf8' }).split('\n');
for (const f of PAGES) if (inTgz.indexOf('release/public/' + f) < 0) throw new Error('в архиве нет release/public/' + f);
console.log(JSON.stringify({ version, pages: PAGES.map((f) => 'public/' + f), tgz: sz('joldas-release.tgz'), signed: sz('joldas-release.signed'), cloudInit: sz('joldas-cloud-init.yaml'), sha256: crypto.createHash('sha256').update(tgz).digest('hex') }, null, 1));
