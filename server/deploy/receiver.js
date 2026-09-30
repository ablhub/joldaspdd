'use strict';
/* Загрузчик первого релиза Жолдас. Работает на порту 80 только до первой успешной установки.
   Принимает архив, подписанный ключом релизов (Ed25519): публичный ключ лежит рядом, секретов на сервере нет. */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUB = fs.readFileSync('/opt/joldas-bootstrap/release.pub', 'utf8');
const VAR = '/var/lib/joldas';
const LOG = '/var/log/joldas-provision.log';
const st = { busy: false, done: null, lastError: null };

const provisioned = () => fs.existsSync(path.join(VAR, '.provisioned'));
function tail(file, n) { try { return fs.readFileSync(file, 'utf8').split('\n').slice(-n).join('\n'); } catch (_) { return ''; } }
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

const PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Жолдас: установка сервера</title><style>
body{margin:0;background:#EDF0F3;color:#121B24;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px}.card{background:#fff;border:1px solid #D6DDE3;border-radius:14px;padding:18px;margin-bottom:14px}
h1{font-size:20px;margin:0 0 6px}pre{background:#1A2129;color:#EDF1F4;border-radius:10px;padding:10px;font-size:12px;overflow:auto;max-height:260px;white-space:pre-wrap}
button{font:inherit;border:0;background:#1B55B5;color:#fff;border-radius:9px;padding:10px 16px;cursor:pointer}button:disabled{opacity:.5}
.ok{color:#137A49;font-weight:700}.err{color:#C3302B;font-weight:700}a{color:#1B55B5}
</style></head><body><main>
<div class="card"><h1>Жолдас: установка сервера</h1><p id="st">Проверяю состояние...</p><pre id="log"></pre></div>
<div class="card"><p>Архив релиза (joldas-release.signed):</p><p><input type="file" id="rel" accept=".signed"></p><button id="go" disabled>Установить</button><p id="res"></p></div>
</main><script>
var $=function(i){return document.getElementById(i);};
var installed=false;
function status(){ fetch('/status',{cache:'no-store'}).then(function(r){return r.json();}).then(function(s){
  if(installed) return;
  $('log').textContent=s.log||'';
  if(s.done){ installed=true; $('st').innerHTML='<span class="ok">Уже установлено.</span>'; return; }
  $('st').textContent=s.provisioned?'Сервер готов к установке.':'Сервер настраивается (обычно 3-6 минут)...';
  $('go').disabled=!s.provisioned||s.busy;
  if(s.lastError){ $('res').innerHTML='<span class="err"></span>'; $('res').firstChild.textContent='Ошибка: '+s.lastError; }
}).catch(function(){}).then(function(){ if(!installed) setTimeout(status,3000); }); }
status();
function probe(urls,setup){ var found=false;
  urls.forEach(function(u){ fetch(u+'/api/v1/health',{cache:'no-store'}).then(function(r){ if(r.ok && !found){ found=true;
    $('st').innerHTML='<span class="ok">Сайт работает:</span> <a id="site" target="_blank"></a>';
    $('site').href=u; $('site').textContent=u;
    if(setup){ var p=document.createElement('p'); var a=document.createElement('a'); a.id='setup'; a.href=u+'/admin#setup='+setup; a.textContent='Открыть настройку админки'; p.appendChild(a); $('res').appendChild(p); } } }).catch(function(){}); });
  setTimeout(function(){ if(!found) probe(urls,setup); },4000); }
$('go').addEventListener('click',function(){ var f=$('rel').files[0]; if(!f){ $('res').textContent='Выберите файл'; return; }
  $('go').disabled=true; $('res').textContent='Загружаю и устанавливаю (около минуты)...';
  f.arrayBuffer().then(function(b){ return fetch('/upload',{method:'POST',body:b}); }).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||r.status); return j; }); })
   .then(function(d){ installed=true; $('res').innerHTML=''; var p=document.createElement('p'); p.className='ok'; p.textContent='Установлено. Запускаю HTTPS, это занимает до 2 минут.'; $('res').appendChild(p);
     $('st').textContent='Жду сертификат HTTPS...'; probe(d.urls,d.setup); })
   .catch(function(e){ $('go').disabled=false; $('res').innerHTML='<span class="err"></span>'; $('res').firstChild.textContent='Ошибка: '+e.message; });
});
</script></body></html>`;

http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE);
  }
  if (req.method === 'GET' && req.url === '/status') {
    const pub = st.done ? { urls: st.done.urls, at: st.done.at } : null;
    return sendJson(res, 200, { provisioned: provisioned(), busy: st.busy, done: pub, lastError: st.lastError, log: tail(LOG, 18) });
  }
  if (req.method === 'POST' && req.url === '/upload') {
    if (!provisioned()) return sendJson(res, 409, { error: 'Сервер еще настраивается, подождите' });
    if (st.done) return sendJson(res, 409, { error: 'Уже установлено' });
    if (st.busy) return sendJson(res, 409, { error: 'Установка уже идет' });
    st.busy = true;
    const chunks = [];
    let size = 0, aborted = false;
    req.on('data', (c) => { size += c.length; if (size > 40 * 1024 * 1024) { aborted = true; st.busy = false; req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      if (aborted) return;
      try {
        const buf = Buffer.concat(chunks);
        if (buf.length < 200 || buf.slice(0, 4).toString('latin1') !== 'JSIG') throw new Error('Это не подписанный архив релиза');
        const sig = buf.slice(4, 68), tgz = buf.slice(68);
        if (!crypto.verify(null, tgz, PUB, sig)) throw new Error('Подпись архива не совпала');
        const file = path.join(VAR, 'first-release.tgz');
        fs.writeFileSync(file, tgz, { mode: 0o600 });
        const tmp = fs.mkdtempSync('/tmp/joldas-rel-');
        let r = await run('tar', ['-xzf', file, '-C', tmp]);
        if (r.code !== 0) throw new Error('Не удалось распаковать архив: ' + r.out.slice(-400));
        r = await run('/bin/bash', [path.join(tmp, 'release', 'deploy', 'install.sh'), file, '--first']);
        fs.appendFileSync(LOG, '\n== install --first (' + new Date().toISOString() + ')\n' + r.out + '\n');
        if (r.code !== 0) throw new Error('Установка не удалась:\n' + r.out.slice(-1500));
        const env = fs.readFileSync('/etc/joldas/env', 'utf8');
        const ip = ((env.match(/^PUBLIC_IP=(.*)$/m) || [])[1] || '').trim();
        const d = ip.replace(/\./g, '-');
        let setup = '';
        try { setup = fs.readFileSync(path.join(VAR, 'setup-code'), 'utf8').trim(); } catch (_) { /* none */ }
        st.done = { urls: ['https://' + d + '.sslip.io', 'https://' + d + '.nip.io'], at: Date.now() };
        st.busy = false;
        st.lastError = null;
        sendJson(res, 200, Object.assign({ setup }, st.done));
        setTimeout(() => {
          spawn('systemd-run', ['--no-block', '--unit=joldas-finish-first-' + Date.now(), '/bin/bash', '/opt/joldas/current/deploy/finish-first.sh'], { detached: true, stdio: 'ignore' }).unref();
        }, 1500);
      } catch (e) {
        st.busy = false;
        st.lastError = String((e && e.message) || e);
        sendJson(res, 400, { error: st.lastError });
      }
    });
    return;
  }
  return sendJson(res, 404, { error: 'not found' });
}).listen(80, '0.0.0.0', () => console.log('joldas bootstrap receiver on :80'));
