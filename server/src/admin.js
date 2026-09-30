'use strict';
/* Страница админки: одна HTML-страница со встроенными стилями и скриптом. Данные пользователей выводятся только через textContent. */
module.exports = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Жолдас · админка</title>
<style>
:root{--bg:#EDF0F3;--card:#fff;--ink:#121B24;--ink2:#3B4855;--muted:#66737F;--line:#D6DDE3;--line2:#E5E9ED;--blue:#1B55B5;--blue2:#15469A;--soft:#E2EAF8;--red:#C3302B;--redsoft:#FAE6E5;--green:#137A49;--greensoft:#DFF2E7;--yellowsoft:#FFF2C7;--yink:#5B4400;--asph:#1A2129;--series:#2a78d6;--grid:#E9ECEF;--axis:#C3CAD1;--shadow:0 1px 2px rgba(15,23,31,.05),0 6px 20px rgba(15,23,31,.06)}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0D1217;--card:#151C23;--ink:#E7ECF1;--ink2:#B9C3CD;--muted:#8894A0;--line:#2B3641;--line2:#222C36;--blue:#5B93F2;--blue2:#7AA8F5;--soft:#16294A;--red:#EE6B64;--redsoft:#3A1B1A;--green:#43BE82;--greensoft:#12301F;--yellowsoft:#342A10;--yink:#FFE7A3;--asph:#0A0E12;--series:#3987e5;--grid:#222C36;--axis:#39444F;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
button,input,select,textarea{font:inherit;color:inherit}
a{color:var(--blue)}
:focus-visible{outline:3px solid #F2B200;outline-offset:2px;border-radius:6px}
header{background:var(--asph);color:#EDF1F4;position:sticky;top:0;z-index:20}
.hwrap{max-width:1200px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{font-weight:700;font-size:17px;white-space:nowrap}.ver{opacity:.65;font-size:12px}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}.tabs::-webkit-scrollbar{display:none}
.tabs button{border:0;background:none;color:#C9D2DA;padding:8px 12px;border-radius:8px;font-weight:600;white-space:nowrap;cursor:pointer}
.tabs button:hover{background:rgba(255,255,255,.08);color:#fff}
.tabs button[aria-selected="true"]{background:rgba(255,255,255,.14);color:#fff}
.hbtn{border:1px solid rgba(255,255,255,.25);background:transparent;color:#EDF1F4;border-radius:9px;padding:7px 12px;cursor:pointer}
main{max-width:1200px;margin:0 auto;padding:20px 16px 60px}
.card{background:var(--card);border:1px solid var(--line2);border-radius:14px;padding:18px;margin-bottom:16px;box-shadow:var(--shadow)}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 12px}h3{font-size:14px;margin:0 0 8px}
.muted{color:var(--muted)}.small{font-size:13px}.tiny{font-size:12px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.sp{flex:1}
.btn{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;padding:8px 14px;cursor:pointer;min-height:38px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:600}
.btn:hover{border-color:var(--ink2)}
.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}.btn.primary:hover{background:var(--blue2)}
.btn.danger{color:var(--red);border-color:var(--red)}
.btn.sm{min-height:32px;padding:5px 10px;font-size:13px}
.btn:disabled{opacity:.5;cursor:default}
.input{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;padding:8px 11px;min-height:38px;width:100%}
.input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px var(--soft)}
select.input{width:auto}
label.f{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--ink2)}
label.f .input{font-size:15px;font-weight:400;color:var(--ink)}
@media (max-width:640px){.hwrap{gap:6px 10px}.ver{display:none}.tabs{order:3;flex-basis:100%}#logout{margin-left:auto}}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:860px){.grid2,.grid3{grid-template-columns:minmax(0,1fr)}}
.msg{padding:10px 12px;border-radius:9px;background:var(--soft);margin-top:10px;white-space:pre-wrap}.msg.err{background:var(--redsoft);color:var(--red)}.msg.ok{background:var(--greensoft);color:var(--green)}
.warn{background:var(--yellowsoft);color:var(--yink);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-weight:600;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.center{max-width:420px;margin:60px auto}.hide{display:none!important}
code{background:var(--bg);padding:1px 5px;border-radius:5px}
.badge{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bg);color:var(--ink2);white-space:nowrap}
.badge.ok{background:var(--greensoft);color:var(--green)}.badge.bad{background:var(--redsoft);color:var(--red)}.badge.blue{background:var(--soft);color:var(--blue)}
/* stat tiles */
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.tile{background:var(--bg);border-radius:12px;padding:12px 14px}
.tile .l{font-size:12px;color:var(--muted)}.tile .v{font-size:24px;font-weight:650;line-height:1.2;margin-top:2px}.tile .s{font-size:12px;color:var(--ink2);margin-top:2px}
.hero{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}.hero .v{font-size:48px;font-weight:650;line-height:1}.hero .l{color:var(--ink2)}
/* charts */
.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media (max-width:860px){.charts{grid-template-columns:minmax(0,1fr)}}
.chart{position:relative}
.chart svg{display:block;width:100%;overflow:visible}
.chart .grid{stroke:var(--grid);stroke-width:1;shape-rendering:crispEdges}
.chart .base{stroke:var(--axis);stroke-width:1;shape-rendering:crispEdges}
.chart .tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.chart .lbl{fill:var(--ink2);font-size:11px;font-weight:600}
.chart .bar{fill:var(--series);pointer-events:none}
.chart .hit{fill:transparent;cursor:default;outline:none}
.chart .hit:hover+.bar,.chart .hit:focus+.bar,.chart .bar.on{opacity:.72}
.ctitle{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.ctitle b{font-size:14px}.ctitle span{font-size:12px;color:var(--muted)}
.tip{position:absolute;pointer-events:none;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12px;box-shadow:var(--shadow);white-space:nowrap;z-index:5;transform:translate(-50%,-100%)}
.tip b{font-size:14px;display:block}
.hbar{display:grid;grid-template-columns:minmax(80px,max-content) minmax(0,1fr) 56px;gap:4px 10px;align-items:center;font-size:13px}
.hbar .t{height:10px;background:var(--grid);border-radius:0 4px 4px 0;overflow:hidden}
.hbar .t i{display:block;height:100%;background:var(--series);border-radius:0 4px 4px 0;min-width:2px}
.hbar .n{text-align:right;color:var(--ink2);font-variant-numeric:tabular-nums}
.hbar .k{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line2);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
tr.click{cursor:pointer}tr.click:hover td{background:var(--bg)}
/* feed */
.feed{display:flex;flex-direction:column}
.ev{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;padding:9px 0;border-top:1px solid var(--line2);font-size:14px}
.ev:first-child{border-top:0}
.ev time{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;padding-top:2px}
.ev .who{font-weight:600}
.linkbtn{border:0;background:none;padding:0;color:var(--blue);font:inherit;font-weight:600;cursor:pointer;text-align:left}
.linkbtn:hover{text-decoration:underline}
.online{display:flex;flex-direction:column;gap:6px}
.online div{display:flex;justify-content:space-between;gap:8px;font-size:14px}
/* drawer */
.ovl{position:fixed;inset:0;background:rgba(8,12,16,.5);z-index:40;display:flex;justify-content:flex-end}
.drawer{background:var(--bg);width:min(760px,100%);height:100%;overflow:auto;padding:18px 16px 40px;box-shadow:0 0 40px rgba(0,0,0,.3)}
.dh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
.kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 14px;font-size:14px}
.kv dt{color:var(--muted)}.kv dd{margin:0;overflow-wrap:anywhere}
.secret{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;font-weight:700;letter-spacing:.08em;background:var(--card);border:1px dashed var(--line);border-radius:8px;padding:6px 12px}
.pager{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:12px}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
.filters .q{flex:1;min-width:220px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--card)}
.seg button{border:0;background:none;padding:7px 12px;font-weight:600;cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{background:var(--blue);color:#fff}
.loading{opacity:.55;transition:opacity .2s}
.empty{color:var(--muted);font-size:14px;padding:10px 0}
</style></head><body>
<header><div class="hwrap"><span class="brand">Жолдас · админка</span><span class="ver" id="ver"></span>
<nav class="tabs hide" id="tabs" role="tablist" aria-label="Разделы админки">
<button role="tab" data-tab="overview">Обзор</button><button role="tab" data-tab="activity">Активность</button><button role="tab" data-tab="users">Пользователи</button><button role="tab" data-tab="settings">Настройки</button></nav>
<button id="logout" class="hbtn hide">Выйти</button></div></header>
<main>
<section id="v-setup" class="card center hide">
  <h2>Задайте пароль администратора</h2>
  <p class="muted small">Пароль вводите сами и никому его не сообщайте. Не короче 10 символов. Восстановить его можно только через консоль сервера.</p>
  <form id="f-setup"><p><input class="input" type="password" id="s-pw" autocomplete="new-password" placeholder="Пароль" required minlength="10"></p>
  <p><input class="input" type="password" id="s-pw2" autocomplete="new-password" placeholder="Повторите пароль" required minlength="10"></p>
  <button class="btn primary" type="submit">Сохранить и войти</button></form><div id="m-setup"></div>
</section>
<section id="v-login" class="card center hide">
  <h2>Вход</h2>
  <form id="f-login"><p><input class="input" type="password" id="l-pw" autocomplete="current-password" placeholder="Пароль администратора" required></p>
  <button class="btn primary" type="submit">Войти</button></form><div id="m-login"></div>
</section>
<section id="v-nosetup" class="card center hide">
  <h2>Админка еще не настроена</h2>
  <p class="muted">Откройте ссылку настройки, которую показала страница установки, или создайте новую на сервере командой <code>sudo joldas-admin-reset</code>.</p>
</section>
<div id="v-app" class="hide"><div id="warn"></div><div id="page"></div></div>
</main>
<div id="drawer"></div>
<script>
(function(){
var $=function(id){return document.getElementById(id);};
function h(tag, props){
  var e=document.createElement(tag);
  if(props) for(var k in props){ var v=props[k]; if(v==null||v===false) continue;
    if(k==='class') e.className=v; else if(k==='text') e.textContent=v; else if(k==='style') e.setAttribute('style',v);
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v); else e.setAttribute(k, v===true?'':v); }
  for(var i=2;i<arguments.length;i++) add(e, arguments[i]);
  return e;
}
function add(e,c){ if(c==null||c===false) return; if(Array.isArray(c)){ c.forEach(function(x){add(e,x);}); return; } e.appendChild(c instanceof Node?c:document.createTextNode(String(c))); }
function clear(e){ while(e.firstChild) e.removeChild(e.firstChild); return e; }
var SVGNS='http://www.w3.org/2000/svg';
function s(tag, attrs){ var e=document.createElementNS(SVGNS,tag); for(var k in attrs||{}) e.setAttribute(k, attrs[k]); return e; }

function api(method,url,body,raw){
  var o={method:method,credentials:'same-origin',headers:{'X-Requested-With':'joldas'}};
  if(raw){o.body=raw;o.headers['Content-Type']='application/gzip';} else if(body){o.body=JSON.stringify(body);o.headers['Content-Type']='application/json';}
  return fetch(url,o).then(function(r){ return r.json().catch(function(){return {};}).then(function(j){
    if(!r.ok){ var e=new Error(j.error||('Ошибка '+r.status)); e.status=r.status; if(r.status===401 && APP) { APP=false; show('v-login'); msg('m-login','Сессия истекла, войдите снова',true); } throw e; }
    return j; }); });
}
function show(id){ ['v-setup','v-login','v-nosetup','v-app'].forEach(function(v){ $(v).classList.toggle('hide', v!==id); }); $('logout').classList.toggle('hide', id!=='v-app'); $('tabs').classList.toggle('hide', id!=='v-app'); }
function msg(id,text,kind){ var e=$(id); if(!e) return; e.className='msg'+(kind===true||kind==='err'?' err':(kind==='ok'?' ok':'')); e.textContent=text; }
function msgEl(text,kind){ return h('div',{class:'msg'+(kind==='err'?' err':(kind==='ok'?' ok':'')),text:text}); }
var nf=new Intl.NumberFormat('ru-RU');
function fmtN(n){ return nf.format(Number(n||0)); }
function compact(n){ n=Number(n||0); if(n>=1e6) return (Math.round(n/1e5)/10).toString().replace('.',',')+' млн'; if(n>=1e4) return (Math.round(n/100)/10).toString().replace('.',',')+' тыс.'; return fmtN(n); }
function pct(a,b){ return b?Math.round(a*100/b)+'%':'-'; }
function pad(n){ return (n<10?'0':'')+n; }
function fdt(t){ var d=new Date(t); return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
function fd(t){ var d=new Date(t); return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear(); }
function isoToRu(s){ var m=/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s||''); return m?m[3]+'.'+m[2]+'.'+m[1]:(s||''); }
function ago(t){ if(!t) return '-'; var m=Math.round((Date.now()-new Date(t).getTime())/60000); if(m<1) return 'только что'; if(m<60) return m+' мин назад'; var hh=Math.round(m/60); if(hh<24) return hh+' ч назад'; var d=Math.round(hh/24); if(d<31) return d+' дн. назад'; return fd(t); }
function phoneFmt(p){ var d=String(p||'').replace(/\\D/g,''); return d.length===11?'+'+d[0]+' '+d.slice(1,4)+' '+d.slice(4,7)+' '+d.slice(7,9)+' '+d.slice(9):(p||''); }
function fullName(u){ return ((u.first_name||'')+' '+(u.last_name||'')).trim()||'Удаленный пользователь'; }
var CATS=['A1','A','B1','B','BE','C1','C','C1E','CE','D1','D','D1E','DE','Tb','Tm'];
/* язык интерфейса ученика: сайт на русском (/), казахском (/kk/) и английском (/en/) */
var LANGS=['ru','kk','en'], LANGN={ru:'русский',kk:'казахский',en:'английский'}, LANGT={ru:'Русский',kk:'Казахский',en:'Английский'}, LANGSH={ru:'РУС',kk:'ҚАЗ',en:'ENG'};
function langName(l){ return LANGN[l]||l||'-'; }

var setupCode=(location.hash.match(/setup=([a-f0-9]+)/)||[])[1]||'';
var APP=false, ST={tab:'overview', days:30, min:20, feedType:'', uq:{q:'',cat:'',lang:'',status:'',marketing:'',active:'',sort:'new',page:1}}, SITE=null, TIMER=null;

/* тексты вопросов и названия тем берем из самой страницы сайта */
function siteData(){ if(SITE) return Promise.resolve(SITE);
  return fetch('/assets/qindex.json',{credentials:'omit'}).then(function(r){return r.json();}).then(function(d){
    SITE={q:{},m:d.m||{}}; Object.keys(d.q||{}).forEach(function(id){ var x=d.q[id]; SITE.q[id]={q:x.q,m:(d.m||{})[x.m]||''}; });
    return SITE; }).catch(function(){ SITE={q:{},m:{}}; return SITE; }); }

/* ---------- графики ---------- */
function niceMax(v){ if(v<=4) return 4; var p=Math.pow(10,Math.floor(Math.log10(v))), n=v/p; var m=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10; return m*p; }
function columnChart(box, rows, key, label){
  clear(box); box.classList.add('chart');
  var W=Math.max(260, box.clientWidth||520), H=150, L=34, R=6, T=16, B=22, pw=W-L-R, ph=H-T-B, n=rows.length;
  var max=0, total=0, maxI=-1; rows.forEach(function(r,i){ var v=r[key]||0; total+=v; if(v>max){ max=v; maxI=i; } });
  var top=niceMax(max||1), svg=s('svg',{viewBox:'0 0 '+W+' '+H, height:H, role:'img', 'aria-label':label+': всего '+total});
  [0,0.5,1].forEach(function(f){ var y=T+ph-ph*f; svg.appendChild(s('line',{class:f===0?'base':'grid',x1:L,x2:W-R,y1:y,y2:y})); var tx=s('text',{class:'tick',x:L-6,y:y+4,'text-anchor':'end'}); tx.textContent=compact(Math.round(top*f)); svg.appendChild(tx); });
  var slot=pw/n, bw=Math.max(2, Math.min(24, slot-2));
  var tip=h('div',{class:'tip hide'});
  rows.forEach(function(r,i){
    var v=r[key]||0, bh=ph*v/top, x=L+i*slot+(slot-bw)/2, y=T+ph-bh;
    var hit=s('rect',{class:'hit',x:L+i*slot,y:T,width:slot,height:ph,tabindex:0,'aria-label':isoToRu(r.day)+': '+v});
    svg.appendChild(hit);
    var bar;
    if(v>0){ var rr=Math.min(4,bw/2,bh); bar=s('path',{class:'bar',d:'M'+x+' '+(T+ph)+'V'+(y+rr)+'Q'+x+' '+y+' '+(x+rr)+' '+y+'H'+(x+bw-rr)+'Q'+(x+bw)+' '+y+' '+(x+bw)+' '+(y+rr)+'V'+(T+ph)+'Z'}); }
    else bar=s('path',{class:'bar',d:''});
    svg.appendChild(bar);
    function on(){ tip.classList.remove('hide'); clear(tip); add(tip,[h('b',{text:fmtN(v)}), isoToRu(r.day)]); tip.style.left=((x+bw/2)/W*100)+'%'; tip.style.top=Math.max(0,y-6)+'px'; }
    function off(){ tip.classList.add('hide'); }
    hit.addEventListener('pointerenter',on); hit.addEventListener('pointerleave',off); hit.addEventListener('focus',on); hit.addEventListener('blur',off);
    if(i===maxI && v>0){ var t=s('text',{class:'lbl',x:x+bw/2,y:y-4,'text-anchor':'middle'}); t.textContent=fmtN(v); svg.appendChild(t); }
  });
  [0,Math.floor((n-1)/2),n-1].forEach(function(i){ if(!rows[i]) return; var t=s('text',{class:'tick',x:L+i*slot+slot/2,y:H-6,'text-anchor':i===0?'start':(i===n-1?'end':'middle')}); t.textContent=isoToRu(rows[i].day).slice(0,5); svg.appendChild(t); });
  box.appendChild(svg); box.appendChild(tip);
  return total;
}
function hbars(list, fmtKey){
  var max=Math.max.apply(null,[1].concat(list.map(function(x){return x.n;})));
  if(!list.length) return h('p',{class:'empty',text:'Пока нет данных'});
  var g=h('div',{class:'hbar'});
  list.forEach(function(x){ g.appendChild(h('span',{class:'k',title:x.k,text:x.k})); var t=h('span',{class:'t'}); t.appendChild(h('i',{style:'width:'+(x.n?Math.max(1,Math.round(x.n*100/max)):0)+'%;'+(x.n?'':'min-width:0')})); g.appendChild(t); g.appendChild(h('span',{class:'n',text:fmtN(x.n)})); });
  return g;
}
function tile(label, value, sub){ return h('div',{class:'tile'}, h('div',{class:'l',text:label}), h('div',{class:'v',text:value}), sub?h('div',{class:'s',text:sub}):null); }
var CHARTS=[];
window.addEventListener('resize', function(){ clearTimeout(window._rz); window._rz=setTimeout(function(){ CHARTS.forEach(function(c){ columnChart(c[0],c[1],c[2],c[3]); }); },150); });

/* ---------- обзор ---------- */
function renderOverview(page){
  var pageEl=page||$('page'); var head=h('div',{class:'row',style:'margin-bottom:14px'}, h('h1',{text:'Обзор площадки'}), h('span',{class:'sp'}));
  var seg=h('div',{class:'seg',role:'group','aria-label':'Период'});
  [7,30,90].forEach(function(d){ seg.appendChild(h('button',{type:'button','aria-pressed':String(ST.days===d),text:d+' дней',onclick:function(){ ST.days=d; renderTab(); }})); });
  head.appendChild(seg);
  var body=h('div',{class:'loading'}); clear(pageEl); add(pageEl,[head, body]);
  return Promise.all([api('GET','/admin/api/overview?days='+ST.days+'&min='+ST.min), siteData()]).then(function(r){
    var o=r[0], t=o.totals; clear(body); body.classList.remove('loading'); renderWarn(o.setupMissing);
    $('ver').textContent='версия '+o.version;
    var hero=h('div',{class:'hero'}, h('span',{class:'v',text:fmtN(t.users_total)}), h('span',{class:'l',text:'зарегистрированных учеников · сейчас на сайте '+fmtN(t.online)}));
    var tiles=h('div',{class:'tiles'},
      tile('Новые сегодня', fmtN(t.new_today), 'за 7 дней: '+fmtN(t.new_7d)+' · за 30: '+fmtN(t.new_30d)),
      tile('Активны сегодня', fmtN(t.active_today), 'за 7 дней: '+fmtN(t.active_7d)+' · за 30: '+fmtN(t.active_30d)),
      tile('Ответов сегодня', compact(t.answers_today), 'всего '+compact(t.answers_total)+' · верных '+pct(t.answers_correct,t.answers_total)),
      tile('Пробные экзамены', compact(t.exams_total), 'сегодня '+fmtN(t.exams_today)+' · сдали '+pct(t.exams_passed,t.exams_total)),
      tile('Тест гостя за 30 дней', fmtN(t.trials_30d), 'регистраций после теста: '+fmtN(t.reg_after_trial_30d)+' ('+pct(t.reg_after_trial_30d,t.trials_30d)+')'),
      tile('Согласие на рекламу', fmtN(t.marketing_yes), pct(t.marketing_yes,t.users_total)+' учеников'+(t.blocked?' · заблокировано '+fmtN(t.blocked):'')));
    body.appendChild(h('section',{class:'card'}, hero, tiles));
    var defs=[['reg','Регистрации'],['active','Активные ученики','решали вопросы в этот день'],['answers','Ответы на вопросы'],['exams','Пробные экзамены'],['passed','Сданные экзамены','32 и больше верных'],['trials','Пробный тест гостей','без регистрации']];
    var grid=h('div',{class:'charts'}); CHARTS=[];
    var boxes=defs.map(function(d){ var box=h('div'); var tot=h('span'); grid.appendChild(h('div',null, h('div',{class:'ctitle'}, h('b',{text:d[1]}), tot), d[2]?h('div',{class:'tiny muted',style:'margin:-4px 0 4px',text:d[2]}):null, box)); return [box,tot,d]; });
    var table=h('table',null, h('thead',null, h('tr',null, h('th',{text:'День'}), defs.map(function(d){ return h('th',{class:'num',text:d[1]}); }))), h('tbody',null, o.series.slice().reverse().map(function(r){ return h('tr',null, h('td',{text:isoToRu(r.day)}), defs.map(function(d){ return h('td',{class:'num',text:fmtN(r[d[0]])}); })); })));
    body.appendChild(h('section',{class:'card'}, h('h2',{text:'По дням за '+ST.days+' дней'}), grid, h('details',{style:'margin-top:14px'}, h('summary',{class:'small',style:'cursor:pointer',text:'Показать таблицей'}), h('div',{class:'tw',style:'margin-top:8px'}, table))));
    boxes.forEach(function(b){ var tot=columnChart(b[0], o.series, b[2][0], b[2][1]); b[1].textContent='всего '+fmtN(tot); CHARTS.push([b[0], o.series, b[2][0], b[2][1]]); });
    var ageOrder=['14-17','18-24','25-34','35-44','45+'], ages=ageOrder.map(function(k){ var x=o.ages.filter(function(a){return a.bucket===k;})[0]; return {k:k+' лет', n:x?x.n:0}; });
    var langs=LANGS.map(function(k){ var x=(o.langs||[]).filter(function(a){return a.lang===k;})[0]; return {k:LANGT[k], n:x?x.n:0}; });
    body.appendChild(h('div',{class:'grid2'},
      h('section',{class:'card',style:'margin-bottom:0'}, h('h2',{text:'Категории учеников'}), hbars(o.categories.map(function(c){ return {k:c.cat, n:c.n}; }))),
      h('div',{style:'display:flex;flex-direction:column;gap:16px;min-width:0'},
        h('section',{class:'card',style:'margin-bottom:0'}, h('h2',{text:'Возраст'}), hbars(t.users_total?ages:[])),
        h('section',{class:'card',id:'ov-langs',style:'margin-bottom:0'}, h('h2',{text:'Языки'}), h('p',{class:'small muted',style:'margin:-6px 0 10px',text:'На каком языке ученики пользуются сайтом'}), hbars(t.users_total?langs:[])))));
    body.appendChild(h('div',{style:'height:16px'}));
    body.appendChild(h('section',{class:'card'}, h('h2',{text:'Популярные темы учебника'}), h('p',{class:'small muted',style:'margin:-6px 0 10px',text:'Сколько учеников отметили тему прочитанной'}), hbars(o.lessons.map(function(l){ return {k:SITE.m[l.mod]||l.mod, n:l.n}; }))));
    var minSel=h('select',{class:'input',onchange:function(){ ST.min=Number(this.value); renderTab(); }}, [5,20,100].map(function(v){ return h('option',{value:v,selected:ST.min===v,text:String(v)}); }));
    var hard=h('tbody');
    o.hardest.forEach(function(q){ var qi=SITE.q[q.question_id]||{q:q.question_id,m:''}; hard.appendChild(h('tr',null, h('td',null, h('div',{text:qi.q}), h('div',{class:'tiny muted',text:q.question_id+(qi.m?' · '+qi.m:'')})), h('td',{class:'num',text:fmtN(q.attempts)}), h('td',{class:'num',text:Math.round(q.acc*100)+'%'}))); });
    if(!o.hardest.length) hard.appendChild(h('tr',null, h('td',{colspan:3,class:'empty',text:'Пока мало ответов. Уменьшите минимум попыток.'})));
    body.appendChild(h('section',{class:'card'}, h('div',{class:'row',style:'margin-bottom:10px'}, h('h2',{style:'margin:0',text:'Самые сложные вопросы'}), h('span',{class:'sp'}), h('label',{class:'small muted'}, 'Минимум попыток ', minSel)),
      h('div',{class:'tw'}, h('table',null, h('thead',null, h('tr',null, h('th',{text:'Вопрос'}), h('th',{class:'num',text:'Попыток'}), h('th',{class:'num',text:'Верно'}))), hard)),
      h('p',{class:'small muted',style:'margin-top:8px',text:'Если вопрос часто решают неверно, проверьте формулировку и объяснение.'})));
  }).catch(function(e){ body.classList.remove('loading'); clear(body).appendChild(msgEl(e.message,'err')); });
}
function renderWarn(missing){ var w=clear($('warn')); if(!missing) return; w.appendChild(h('div',{class:'warn'}, 'Заполните контакты поддержки и данные оператора персональных данных: они показываются ученикам в политике конфиденциальности и при восстановлении пароля.', h('button',{class:'btn sm',text:'Открыть настройки',onclick:function(){ go('settings'); }}))); }

/* ---------- активность ---------- */
var EVN={register:'Регистрация',login:'Вход',trial:'Пробный тест гостя',exam:'Пробный экзамен',lesson:'Тема прочитана',category:'Смена категории',profile:'Изменение профиля',consent:'Согласие на рекламу',password:'Смена пароля',reset:'Сброс прогресса',logout_all:'Выход на всех устройствах',account_deleted:'Удаление аккаунта'};
var FIELDS={firstName:'имя',lastName:'фамилия',birthDate:'дата рождения',lang:'язык'};
function evText(e){ var d=e.data||{};
  switch(e.type){
    case 'register': return 'Регистрация · категория '+(d.cat||'?')+(d.lang?' · язык: '+langName(d.lang):'')+(d.trial?' · после пробного теста':'')+(d.marketing?' · согласие на рекламу':'')+(d.minor?' · до 18 лет':'');
    case 'login': return 'Вход в аккаунт';
    case 'trial': return 'Пробный тест без регистрации: '+d.c+' из '+d.n+(d.pass?', сдан':', не сдан')+' · категория '+(d.cat||'?');
    case 'exam': return 'Пробный экзамен: '+d.c+' из '+d.n+(d.pass?', сдан':', не сдан')+(d.cat?' · категория '+d.cat:'');
    case 'lesson': return 'Прочитана тема «'+((SITE&&SITE.m[d.mod])||d.mod)+'»';
    case 'category': return 'Смена категории: '+d.from+' на '+d.to;
    case 'profile': return 'Изменение профиля: '+(d.fields||[]).map(function(f){return (FIELDS[f]||f)+(f==='lang'&&d.lang?' ('+langName(d.lang)+')':'');}).join(', ');
    case 'consent': return d.marketing?'Дано согласие на рекламу':'Отозвано согласие на рекламу';
    case 'password': return 'Смена пароля';
    case 'reset': return 'Сброс прогресса';
    case 'logout_all': return 'Выход на всех устройствах';
    case 'account_deleted': return 'Аккаунт удален '+(d.by==='admin'?'администратором':'самим учеником');
  } return e.type; }
function evRow(e, withUser){
  var who = e.user_id ? h('button',{class:'linkbtn who',text:fullName(e),onclick:function(){ openUser(e.user_id); }}) : (e.type==='trial'?h('span',{class:'muted',text:'Гость'}):(e.type==='account_deleted'?null:h('span',{class:'muted',text:'Удаленный пользователь'})));
  var pass = (e.type==='exam'||e.type==='trial') ? h('span',{class:'badge '+(e.data&&e.data.pass?'ok':'bad'),text:e.data&&e.data.pass?'сдан':'не сдан'}) : null;
  return h('div',{class:'ev'}, h('time',{datetime:e.at,title:fdt(e.at),text:ago(e.at)}), h('div',null, withUser&&who?[who,h('span',{class:'muted'},' · ')]:null, evText(e), pass?[' ',pass]:null));
}
function renderActivity(){
  var pageEl=$('page'), sel=h('select',{class:'input',onchange:function(){ ST.feedType=this.value; renderTab(); }}, h('option',{value:'',text:'Все события'}), Object.keys(EVN).map(function(k){ return h('option',{value:k,selected:ST.feedType===k,text:EVN[k]}); }));
  var auto=h('input',{type:'checkbox',checked:true});
  var head=h('div',{class:'row',style:'margin-bottom:14px'}, h('h1',{text:'Активность'}), h('span',{class:'sp'}), sel, h('label',{class:'small row',style:'gap:6px'}, auto, 'Обновлять'));
  var feed=h('div',{class:'feed'}), onl=h('div',{class:'online'}), more=h('button',{class:'btn',text:'Показать еще'});
  clear(pageEl); add(pageEl,[head, h('div',{class:'grid2',style:'grid-template-columns:minmax(0,2fr) minmax(0,1fr)'}, h('section',{class:'card'}, h('h2',{text:'Лента событий'}), feed, h('div',{style:'margin-top:12px'}, more)), h('section',{class:'card'}, h('h2',{text:'Сейчас на сайте'}), h('p',{class:'tiny muted',style:'margin:-6px 0 10px',text:'Активность за последние 15 минут'}), onl))]);
  var last=null;
  function load(reset){
    var q='/admin/api/activity?limit=60'+(ST.feedType?'&type='+ST.feedType:'')+(!reset&&last?'&before='+last:'');
    return Promise.all([api('GET',q), siteData()]).then(function(r){ var a=r[0];
      if(reset){ clear(feed); clear(onl); last=null;
        a.online.forEach(function(u){ onl.appendChild(h('div',null, h('button',{class:'linkbtn',text:fullName(u),onclick:function(){ openUser(u.id); }}), h('span',{class:'small muted',text:(u.category||'')+' · '+ago(u.last_seen_at)}))); });
        if(!a.online.length) onl.appendChild(h('p',{class:'empty',text:'Сейчас никого'})); }
      a.events.forEach(function(e){ feed.appendChild(evRow(e,true)); });
      if(a.events.length) last=a.events[a.events.length-1].id;
      if(!feed.childNodes.length) feed.appendChild(h('p',{class:'empty',text:'Событий пока нет'}));
      more.classList.toggle('hide', a.events.length<60);
    }).catch(function(e){ feed.appendChild(msgEl(e.message,'err')); });
  }
  more.onclick=function(){ load(false); };
  load(true);
  clearInterval(TIMER); TIMER=setInterval(function(){ if(ST.tab==='activity' && auto.checked && !document.hidden && !$('drawer').firstChild) load(true); }, 20000);
}

/* ---------- пользователи ---------- */
function usersQuery(extra){ var p=new URLSearchParams(); var q=ST.uq; ['q','cat','lang','status','marketing','active','sort'].forEach(function(k){ if(q[k]) p.set(k,q[k]); }); if(extra) for(var k in extra) p.set(k,extra[k]); return p.toString(); }
function renderUsers(){
  var q=ST.uq, pageEl=$('page');
  function opt(v,t,cur){ return h('option',{value:v,selected:cur===v,text:t}); }
  var search=h('input',{class:'input',type:'search',placeholder:'Имя, фамилия или телефон',value:q.q,'aria-label':'Поиск'});
  var cat=h('select',{class:'input','aria-label':'Категория'}, opt('','Все категории',q.cat), CATS.map(function(c){ return opt(c,c,q.cat); }));
  var lg=h('select',{class:'input','aria-label':'Язык'}, opt('','Все языки',q.lang), LANGS.map(function(l){ return opt(l,LANGT[l],q.lang); }));
  var st=h('select',{class:'input','aria-label':'Статус'}, opt('','Любой статус',q.status), opt('active','Активные',q.status), opt('blocked','Заблокированные',q.status));
  var mk=h('select',{class:'input','aria-label':'Согласие на рекламу'}, opt('','Согласие: все',q.marketing), opt('1','С согласием на рекламу',q.marketing), opt('0','Без согласия',q.marketing));
  var ac=h('select',{class:'input','aria-label':'Активность'}, opt('','Любая активность',q.active), opt('1','Заходили за 7 дней',q.active), opt('0','Не заходят 30+ дней',q.active));
  var so=h('select',{class:'input','aria-label':'Сортировка'}, opt('new','Сначала новые',q.sort), opt('active','По активности',q.sort), opt('answers','По числу ответов',q.sort), opt('exams','По экзаменам',q.sort), opt('name','По фамилии',q.sort));
  function apply(){ q.q=search.value.trim(); q.cat=cat.value; q.lang=lg.value; q.status=st.value; q.marketing=mk.value; q.active=ac.value; q.sort=so.value; q.page=1; load(); }
  [cat,lg,st,mk,ac,so].forEach(function(e){ e.addEventListener('change',apply); });
  var tmr=null; search.addEventListener('input',function(){ clearTimeout(tmr); tmr=setTimeout(apply,350); });
  var csv=h('a',{class:'btn',href:'#',download:'',text:'Выгрузить CSV'});
  var count=h('span',{class:'small muted'}), tbody=h('tbody'), pager=h('div',{class:'pager'}), wrap=h('div',{class:'tw'});
  wrap.appendChild(h('table',null, h('thead',null, h('tr',null, ['Ученик','Кат.','Язык','Возраст','Регистрация','Активность','Решено','Экзамены: сдано из','Реклама','Статус'].map(function(t,i){ return h('th',{class:i>=6&&i<=7?'num':'',text:t}); }))), tbody));
  clear(pageEl); add(pageEl,[h('div',{class:'row',style:'margin-bottom:14px'}, h('h1',{text:'Пользователи'}), h('span',{class:'sp'}), count),
    h('section',{class:'card'}, h('div',{class:'filters'}, h('div',{class:'q'}, search), cat, lg, st, mk, ac, so, csv),
      h('p',{class:'tiny muted',style:'margin:-6px 0 10px',text:'Выгрузка учитывает фильтры. Для рекламных рассылок выбирайте «С согласием на рекламу».'}), wrap, pager)]);
  function load(){
    csv.href='/admin/api/users.csv?'+usersQuery();
    wrap.classList.add('loading');
    return api('GET','/admin/api/users?'+usersQuery({page:q.page,per:50})).then(function(r){
      wrap.classList.remove('loading'); clear(tbody); count.textContent='найдено '+fmtN(r.total);
      r.users.forEach(function(u){
        var tr=h('tr',{class:'click',tabindex:0,onclick:function(){ openUser(u.id); },onkeydown:function(ev){ if(ev.key==='Enter') openUser(u.id); }},
          h('td',null, h('div',{style:'font-weight:600',text:fullName(u)}), h('div',{class:'tiny muted',text:phoneFmt(u.phone)})),
          h('td',{text:u.category||''}), h('td',{class:'small',title:langName(u.lang),text:LANGSH[u.lang]||u.lang||''}), h('td',{text:u.age!=null?String(u.age):''}), h('td',{class:'small',text:fd(u.created_at)}), h('td',{class:'small',text:ago(u.last_seen_at)}),
          h('td',{class:'num'}, fmtN(u.answers), h('div',{class:'tiny muted',text:u.answers?pct(Math.min(u.correct,u.answers),u.answers)+' верно':''})),
          h('td',{class:'num',text:u.exams?(u.passed+' из '+u.exams):'-'}),
          h('td',null, u.marketing_consent?h('span',{class:'badge ok',text:'да'}):h('span',{class:'badge',text:'нет'})),
          h('td',null, u.status==='blocked'?h('span',{class:'badge bad',text:'заблокирован'}):h('span',{class:'badge',text:'активен'})));
        tbody.appendChild(tr); });
      if(!r.users.length) tbody.appendChild(h('tr',null, h('td',{colspan:10,class:'empty',text:'Никого не нашли'})));
      clear(pager); var pages=Math.max(1,Math.ceil(r.total/r.per));
      add(pager,[h('button',{class:'btn sm',disabled:q.page<=1,text:'Назад',onclick:function(){ q.page--; load(); }}), h('span',{class:'small muted',text:'стр. '+q.page+' из '+pages}), h('button',{class:'btn sm',disabled:q.page>=pages,text:'Вперед',onclick:function(){ q.page++; load(); }})]);
    }).catch(function(e){ wrap.classList.remove('loading'); clear(tbody).appendChild(h('tr',null, h('td',{colspan:10}, msgEl(e.message,'err')))); });
  }
  load();
}

/* ---------- карточка ученика ---------- */
function closeUser(){ clear($('drawer')); document.body.style.overflow=''; if(ST.tab==='users') { var t=document.querySelector('tbody'); } }
function openUser(id){
  var dr=clear($('drawer')); document.body.style.overflow='hidden';
  var panel=h('div',{class:'drawer',role:'dialog','aria-modal':'true','aria-label':'Карточка ученика'}, h('p',{class:'muted',text:'Загружаю...'}));
  var ovl=h('div',{class:'ovl',onclick:function(ev){ if(ev.target===ovl) closeUser(); }}, panel); dr.appendChild(ovl);
  Promise.all([api('GET','/admin/api/users/'+id), siteData()]).then(function(r){ renderUser(panel, r[0], id); }).catch(function(e){ clear(panel); add(panel,[msgEl(e.message,'err'), h('button',{class:'btn',text:'Закрыть',onclick:closeUser})]); });
}
function renderUser(panel, d, id){
  var u=d.user, st=d.stats; clear(panel);
  var refresh=function(){ openUser(id); if(ST.tab==='users'||ST.tab==='activity'){ /* список обновится при следующем открытии */ } };
  var digits=String(u.phone||'').replace(/\\D/g,'');
  panel.appendChild(h('div',{class:'dh'}, h('div',{style:'flex:1;min-width:0'}, h('h1',{text:fullName(u)}), h('div',{class:'row small'}, h('span',{text:phoneFmt(u.phone)}), h('a',{href:'https://wa.me/'+digits,target:'_blank',rel:'noopener',text:'WhatsApp'}), h('a',{href:'tel:+'+digits,text:'Позвонить'}), u.status==='blocked'?h('span',{class:'badge bad',text:'заблокирован'}):h('span',{class:'badge ok',text:'активен'}))), h('button',{class:'btn',text:'Закрыть',onclick:closeUser})));
  if(u.status==='blocked') panel.appendChild(h('div',{class:'warn'}, 'Заблокирован '+(u.blocked_at?fdt(u.blocked_at):'')+(u.blocked_reason?' · причина: '+u.blocked_reason:'')));
  panel.appendChild(h('section',{class:'card'}, h('div',{class:'tiles'},
    tile('Решено вопросов', fmtN(st.answers), st.answers?pct(Math.min(st.correct,st.answers),st.answers)+' верных':'пока нет'),
    tile('Дней занятий', fmtN(st.days), 'последний визит '+ago(u.last_seen_at)),
    tile('Экзамены', d.exams.length?(d.exams.filter(function(e){return e.correct>=32;}).length+' из '+d.exams.length):'0', 'сдано из всех'),
    tile('Прочитано тем', fmtN(u.lessons_read), 'пройдено вопросов: '+fmtN(u.q_seen)),
    tile('Категория', u.category||'-', u.exam_date?'экзамен '+isoToRu(u.exam_date):'дата экзамена не указана'),
    tile('Возраст', u.age!=null?u.age+' лет':'-', isoToRu(u.birth_date)))));
  var act=h('div'); panel.appendChild(h('section',{class:'card'}, h('div',{class:'ctitle'}, h('b',{text:'Ответы по дням, 60 дней'}), h('span',{text:'регистрация '+fd(u.created_at)})), act));
  var days=[], map={}; d.days.forEach(function(x){ map[x.day]=x.answers; });
  for(var i=59;i>=0;i--){ var dt=new Date(Date.now()-i*864e5); var k=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate()); days.push({day:k, answers:map[k]||0}); }
  setTimeout(function(){ columnChart(act, days, 'answers', 'Ответы по дням'); }, 0);
  var ex=h('tbody'); d.exams.forEach(function(e){ ex.appendChild(h('tr',null, h('td',{class:'small',text:fdt(e.taken_at)}), h('td',{class:'num',text:e.correct+' из '+e.total}), h('td',null, h('span',{class:'badge '+(e.correct>=32?'ok':'bad'),text:e.correct>=32?'сдан':'не сдан'})), h('td',{class:'small muted',text:e.category||''}))); });
  var tl=h('div',{class:'feed'}); d.events.slice(0,60).forEach(function(e){ tl.appendChild(evRow(e,false)); }); if(!d.events.length) tl.appendChild(h('p',{class:'empty',text:'Событий нет'}));
  panel.appendChild(h('div',{class:'grid2'}, h('section',{class:'card'}, h('h2',{text:'Экзамены'}), d.exams.length?h('div',{class:'tw'}, h('table',null, ex)):h('p',{class:'empty',text:'Экзаменов пока нет'})), h('section',{class:'card'}, h('h2',{text:'История'}), tl)));
  var ce=d.consentEvidence||{};
  panel.appendChild(h('section',{class:'card'}, h('h2',{text:'Согласия'}), h('dl',{class:'kv'},
    h('dt',{text:'Обработка данных'}), h('dd',{text:(u.pd_consent_at?fdt(u.pd_consent_at):'-')+(u.pd_consent_version?' · редакция '+u.pd_consent_version:'')}),
    h('dt',{text:'Реклама'}), h('dd',{text:u.marketing_consent?('да, с '+fdt(u.marketing_consent_at)):(u.marketing_withdrawn_at?'отозвано '+fdt(u.marketing_withdrawn_at):'нет')}),
    u.guardian_consent?[h('dt',{text:'До 18 лет'}), h('dd',{text:'согласие родителя или законного представителя подтверждено при регистрации'})]:null,
    h('dt',{text:'Подтверждение'}), h('dd',{text:(ce.ip?'IP '+ce.ip:'')+(ce.ua?' · '+ce.ua:'')||'-'}),
    h('dt',{text:'Телефон'}), h('dd',{text:u.phone_verified_at?'подтвержден '+fdt(u.phone_verified_at):'не подтвержден по SMS'}),
    h('dt',{text:'Устройств'}), h('dd',{text:fmtN(d.devices.n)+(d.devices.last?' · последнее '+ago(d.devices.last):'')}),
    h('dt',{text:'Язык интерфейса'}), h('dd',{text:langName(u.lang)}))));
  var f={first:h('input',{class:'input',value:u.first_name||'',maxlength:40}), last:h('input',{class:'input',value:u.last_name||'',maxlength:40}), birth:h('input',{class:'input',type:'date',value:u.birth_date||''}), phone:h('input',{class:'input',value:phoneFmt(u.phone),maxlength:20}),
    cat:h('select',{class:'input'}, CATS.map(function(c){ return h('option',{value:c,selected:u.category===c,text:c}); }))};
  var fm=h('div');
  panel.appendChild(h('section',{class:'card'}, h('h2',{text:'Данные ученика'}), h('div',{class:'grid3'}, h('label',{class:'f'},'Имя',f.first), h('label',{class:'f'},'Фамилия',f.last), h('label',{class:'f'},'Дата рождения',f.birth), h('label',{class:'f'},'Телефон',f.phone), h('label',{class:'f'},'Категория',f.cat)),
    h('div',{class:'row',style:'margin-top:12px'}, h('button',{class:'btn primary',text:'Сохранить',onclick:function(){ api('PATCH','/admin/api/users/'+id,{firstName:f.first.value,lastName:f.last.value,birthDate:f.birth.value,phone:f.phone.value,category:f.cat.value}).then(function(r){ clear(fm).appendChild(msgEl(r.changed.length?'Сохранено':'Изменений нет','ok')); setTimeout(refresh,700); }).catch(function(e){ clear(fm).appendChild(msgEl(e.message,'err')); }); }})), fm));
  var am=h('div'), reason=h('input',{class:'input',placeholder:'Причина блокировки (видна только вам)',maxlength:200}), delc=h('input',{class:'input',placeholder:'Напишите УДАЛИТЬ'});
  function act2(method,url,body,okText){ return api(method,url,body).then(function(r){ clear(am).appendChild(msgEl(okText,'ok')); return r; }).catch(function(e){ clear(am).appendChild(msgEl(e.message,'err')); throw e; }); }
  var actions=h('div',{class:'stack',style:'display:flex;flex-direction:column;gap:14px'},
    h('div',null, h('h3',{text:'Пароль'}), h('p',{class:'small muted',style:'margin:0 0 8px',text:'Ученик забыл пароль? Выдайте временный: при входе система попросит задать новый. Все сеансы ученика завершатся.'}),
      h('button',{class:'btn',text:'Выдать временный пароль',onclick:function(){ if(!confirm('Сбросить пароль и выдать временный?')) return; act2('POST','/admin/api/users/'+id+'/reset-password',{},'Пароль сброшен').then(function(r){ clear(am); add(am,[h('p',{class:'small',text:'Временный пароль (показывается один раз, передайте ученику):'}), h('div',{class:'row'}, h('span',{class:'secret',text:r.tempPassword}), h('button',{class:'btn sm',text:'Скопировать',onclick:function(){ try{ navigator.clipboard.writeText(r.tempPassword); this.textContent='Скопировано'; }catch(x){} }}))]); }).catch(function(){}); }})),
    h('div',null, h('h3',{text:'Сеансы'}), h('button',{class:'btn',text:'Завершить все сеансы',onclick:function(){ act2('POST','/admin/api/users/'+id+'/logout-all',{},'Сеансы завершены').catch(function(){}); }})),
    u.marketing_consent?h('div',null, h('h3',{text:'Реклама'}), h('button',{class:'btn',text:'Отозвать согласие на рекламу',onclick:function(){ if(!confirm('Отметить, что ученик отказался от рекламных сообщений?')) return; act2('PATCH','/admin/api/users/'+id,{marketingConsent:false},'Согласие отозвано').then(function(){ setTimeout(refresh,700); }).catch(function(){}); }})):null,
    h('div',null, h('h3',{text:'Доступ'}), u.status==='blocked'
      ? h('button',{class:'btn',text:'Разблокировать',onclick:function(){ act2('POST','/admin/api/users/'+id+'/unblock',{},'Разблокирован').then(function(){ setTimeout(refresh,600); }).catch(function(){}); }})
      : h('div',{class:'row'}, h('div',{style:'flex:1;min-width:200px'}, reason), h('button',{class:'btn danger',text:'Заблокировать',onclick:function(){ act2('POST','/admin/api/users/'+id+'/block',{reason:reason.value},'Заблокирован').then(function(){ setTimeout(refresh,600); }).catch(function(){}); }}))),
    h('div',null, h('h3',{text:'Удаление'}), h('p',{class:'small muted',style:'margin:0 0 8px',text:'Удалит аккаунт, прогресс и персональные данные. Статистика экзаменов останется обезличенной.'}),
      h('div',{class:'row'}, h('div',{style:'flex:1;min-width:200px'}, delc), h('button',{class:'btn danger',text:'Удалить навсегда',onclick:function(){ if(delc.value.trim().toUpperCase()!=='УДАЛИТЬ'){ clear(am).appendChild(msgEl('Для удаления напишите УДАЛИТЬ','err')); return; } act2('DELETE','/admin/api/users/'+id,null,'Удален').then(function(){ setTimeout(function(){ closeUser(); if(ST.tab==='users') renderTab(); },700); }).catch(function(){}); }}))));
  panel.appendChild(h('section',{class:'card'}, h('h2',{text:'Управление'}), actions, am));
  if(d.audit.length){ var au=h('div',{class:'feed'}); d.audit.forEach(function(a){ au.appendChild(h('div',{class:'ev'}, h('time',{title:fdt(a.at),text:ago(a.at)}), h('div',{text:AUD[a.action]||a.action}))); }); panel.appendChild(h('section',{class:'card'}, h('h2',{text:'Действия администратора'}), au)); }
  panel.focus && panel.setAttribute('tabindex','-1'); try{ panel.focus(); }catch(x){}
}
var AUD={admin_login_failed:'Неудачная попытка входа в админку',user_edit:'Изменены данные',user_block:'Заблокирован',user_unblock:'Разблокирован',user_reset_password:'Выдан временный пароль',user_logout_all:'Завершены все сеансы',user_delete:'Удален',export_csv:'Выгрузка CSV',settings:'Изменены настройки',admin_login:'Вход в админку',admin_setup:'Настроена админка',admin_password:'Сменен пароль админки',deploy:'Загружено обновление',auto_update:'Изменено автообновление',domain:'Изменен домен',backup_download:'Скачана резервная копия'};

/* ---------- настройки ---------- */
function renderSettings(){
  var pageEl=$('page'); clear(pageEl);
  pageEl.appendChild(h('div',{class:'row',style:'margin-bottom:14px'}, h('h1',{text:'Настройки'})));
  var F={}; ['supportText','supportUrl','supportTextKk','supportTextEn','operatorName','operatorId','operatorAddress','operatorContact'].forEach(function(k){ F[k]=h('input',{class:'input',name:k}); });
  F.supportText.placeholder='например, WhatsApp +7 700 000 00 00'; F.supportUrl.placeholder='https://wa.me/77000000000 или https://t.me/...';
  F.supportTextKk.placeholder='необязательно: для /kk/, иначе русский текст'; F.supportTextEn.placeholder='необязательно: для /en/, иначе русский текст';
  F.operatorName.placeholder='ФИО или наименование (ИП, ТОО)'; F.operatorId.placeholder='12 цифр'; F.operatorAddress.placeholder='адрес для обращений'; F.operatorContact.placeholder='телефон или почта';
  var sm=h('div');
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Поддержка и оператор персональных данных'}),
    h('p',{class:'small muted',style:'margin:-6px 0 12px',text:'Контакт поддержки ученики видят при восстановлении пароля. Данные оператора подставляются в политику конфиденциальности и согласие на обработку данных: заполните их до запуска. Тексты поддержки на казахском и английском необязательны: если их нет, на казахской и английской версиях сайта показывается русский текст.'}),
    h('div',{class:'grid2'}, h('label',{class:'f'},'Как связаться с поддержкой',F.supportText), h('label',{class:'f'},'Ссылка для связи',F.supportUrl), h('label',{class:'f'},'Текст поддержки на казахском',F.supportTextKk), h('label',{class:'f'},'Текст поддержки на английском',F.supportTextEn), h('label',{class:'f'},'Оператор: ФИО или наименование',F.operatorName), h('label',{class:'f'},'ИИН или БИН',F.operatorId), h('label',{class:'f'},'Адрес',F.operatorAddress), h('label',{class:'f'},'Контакт для обращений по персональным данным',F.operatorContact)),
    h('div',{class:'row',style:'margin-top:12px'}, h('button',{class:'btn primary',text:'Сохранить',onclick:function(){ var o={}; for(var k in F) o[k]=F[k].value; api('POST','/admin/api/settings',{settings:o}).then(function(r){ fill(r.settings); clear(sm).appendChild(msgEl('Сохранено','ok')); renderWarn(!r.settings.operatorName||!r.settings.supportText); }).catch(function(e){ clear(sm).appendChild(msgEl(e.message,'err')); }); }}), h('a',{href:'/#privacy',target:'_blank',rel:'noopener',class:'small',text:'Посмотреть политику на сайте'})), sm));
  function fill(s){ for(var k in F) F[k].value=s[k]||''; }
  api('GET','/admin/api/settings').then(function(r){ fill(r.settings); renderWarn(!r.settings.operatorName||!r.settings.supportText); }).catch(function(){});
  var bl=h('div',{class:'small'});
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Резервные копии базы'}), bl, h('p',{class:'row',style:'margin-top:10px'}, h('a',{class:'btn',href:'/admin/backup/latest',text:'Скачать последнюю'})), h('p',{class:'small muted',text:'Копия создается автоматически каждую ночь в 03:30, хранятся 14 последних. В базе есть персональные данные учеников: храните скачанные копии в надежном месте.'})));
  api('GET','/admin/api/backups').then(function(b){ bl.textContent=b.backups.length?b.backups.slice(0,5).map(function(x){ return x.name+' ('+Math.round(x.size/1024)+' КБ)'; }).join(', '):'Пока нет копий: первая появится этой ночью.'; }).catch(function(){});
  var rel=h('input',{type:'file',accept:'.signed'}), dm=h('div'), dbtn=h('button',{class:'btn primary',text:'Загрузить и установить'});
  dbtn.onclick=function(){ var file=rel.files[0]; if(!file){ clear(dm).appendChild(msgEl('Выберите файл релиза','err')); return; } dbtn.disabled=true; clear(dm).appendChild(msgEl('Загружаю '+Math.round(file.size/1024)+' КБ...'));
    file.arrayBuffer().then(function(buf){ return api('POST','/admin/api/deploy',null,buf); }).then(function(r){ clear(dm).appendChild(msgEl('Архив принят (SHA-256 '+r.sha256.slice(0,12)+'...). Устанавливаю...')); poll(0); }).catch(function(e){ dbtn.disabled=false; clear(dm).appendChild(msgEl(e.message,'err')); }); };
  function poll(n){ setTimeout(function(){ api('GET','/admin/api/deploy-status').then(function(s2){
    if(s2.state==='ok'){ clear(dm).appendChild(msgEl('Готово: установлена версия '+(s2.version||'')+'. Обновите страницу.','ok')); dbtn.disabled=false; ghb.disabled=false; return; }
    if(s2.state==='error'){ clear(dm).appendChild(msgEl('Ошибка установки: '+(s2.error||'')+(s2.log?'\\n'+s2.log:''),'err')); dbtn.disabled=false; ghb.disabled=false; return; }
    if(n>90){ clear(dm).appendChild(msgEl('Установка идет дольше обычного. Обновите страницу через минуту.','err')); dbtn.disabled=false; ghb.disabled=false; return; }
    poll(n+1); }).catch(function(){ poll(n+1); }); }, 2000); }
  var ghb=h('button',{class:'btn',text:'Обновить с GitHub'});
  ghb.onclick=function(){ ghb.disabled=true; dbtn.disabled=true; clear(dm).appendChild(msgEl('Скачиваю последний релиз с GitHub...'));
    api('POST','/admin/api/deploy-github',{repo:ghr.value}).then(function(r){ clear(dm).appendChild(msgEl('Релиз получен (SHA-256 '+r.sha256.slice(0,12)+'...). Проверяю подпись и устанавливаю...')); poll(0); }).catch(function(e){ ghb.disabled=false; dbtn.disabled=false; clear(dm).appendChild(msgEl(e.message,'err')); }); };
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Обновление сайта'}), h('p',{class:'small muted',style:'margin:-6px 0 10px',text:'Загрузите подписанный архив релиза (.signed) или возьмите последний релиз из репозитория, указанного в карточке «Автообновление с GitHub». Сервер установит его, только если подпись совпадет с ключом релизов, откуда бы файл ни пришел. Установка занимает около минуты, база и прогресс учеников сохраняются.'}), h('div',{class:'row'}, rel, dbtn), h('div',{class:'row',style:'margin-top:10px'}, ghb), dm));
  var aus=h('div',{class:'small',style:'margin:8px 0'}), aum=h('div'), aut=h('input',{type:'checkbox',id:'autoUp'}), ghr=h('input',{class:'input',placeholder:'владелец/репозиторий',style:'max-width:260px',autocomplete:'off'});
  var AUR={'up-to-date':'установлена самая свежая версия',queued:'новая версия отправлена на установку',busy:'идет установка',error:'не удалось проверить','no-release':'релизов пока нет',skip:'релиз с неподходящим тегом пропущен','failed-before':'версия не встала, жду новый релиз'};
  function auShow(s){ aut.checked=!!s.enabled; if(document.activeElement!==ghr) ghr.value=s.repo||''; clear(aus); aus.appendChild(document.createTextNode('Установлена версия '+s.version+'. Проверка раз в '+s.everyMinutes+' мин. '+(s.lastCheck?('Последняя проверка: '+ago(s.lastCheck)+', '+(AUR[s.lastResult]||s.lastResult)+(s.lastTag?' (релиз '+s.lastTag+')':'')+'. '):'Проверок еще не было. ')+(s.lastError?s.lastError+'.':''))); }
  function auLoad(){ api('GET','/admin/api/auto-update').then(auShow).catch(function(){}); }
  aut.onchange=function(){ api('POST','/admin/api/auto-update',{enabled:aut.checked}).then(function(s){ auShow(s); clear(aum).appendChild(msgEl(s.enabled?'Автообновление включено':'Автообновление выключено','ok')); }).catch(function(e){ clear(aum).appendChild(msgEl(e.message,'err')); auLoad(); }); };
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Автообновление с GitHub'}), h('p',{class:'small muted',style:'margin:-6px 0 10px',text:'Сервер сам проверяет последний релиз репозитория и устанавливает его, если версия новее установленной и подпись верна. Укажите репозиторий, откуда брать релизы (публичный). Новый релиз появляется там после каждого успешного прохождения проверок.'}),
    h('label',{class:'row',style:'gap:8px;align-items:center'}, aut, h('span',{text:'Обновлять сайт автоматически'})), aus,
    h('div',{class:'row',style:'margin-bottom:8px'}, ghr, h('button',{class:'btn',text:'Сохранить репозиторий',onclick:function(){ api('POST','/admin/api/auto-update',{repo:ghr.value}).then(function(s){ auShow(s); clear(aum).appendChild(msgEl('Репозиторий сохранен: '+s.repo,'ok')); }).catch(function(e){ clear(aum).appendChild(msgEl(e.message,'err')); }); }})),
    h('div',{class:'row'}, h('button',{class:'btn',text:'Проверить сейчас',onclick:function(){ clear(aum).appendChild(msgEl('Проверяю GitHub...')); api('POST','/admin/api/auto-update',{check:true}).then(function(s){ auShow(s); clear(aum).appendChild(msgEl(s.lastResult==='queued'?'Найдена новая версия, устанавливаю. Через минуту обновите страницу':(AUR[s.lastResult]||'Готово'),s.lastResult==='error'?'err':'ok')); }).catch(function(e){ clear(aum).appendChild(msgEl(e.message,'err')); }); }})), aum));
  auLoad();
  var dom=h('input',{class:'input',placeholder:'например, joldas.kz',style:'max-width:320px'}), hosts=h('span'), ip=h('b'), dmm=h('div');
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Домен'}), h('p',{class:'small'}, 'Сейчас сайт открывается по адресам: ', hosts), h('p',{class:'small muted'}, 'Чтобы подключить свой домен: у регистратора добавьте запись A для домена со значением ', ip, ', подождите 5-30 минут и нажмите «Подключить». Сертификат HTTPS выпустится автоматически.'),
    h('div',{class:'row'}, dom, h('button',{class:'btn primary',text:'Подключить',onclick:function(){ clear(dmm).appendChild(msgEl('Проверяю DNS...')); api('POST','/admin/api/domain',{domain:dom.value}).then(function(r){ clear(dmm).appendChild(msgEl(r.domain?('Домен '+r.domain+' подключается. Через 1-2 минуты откройте https://'+r.domain):'Домен отключен','ok')); loadDom(); }).catch(function(e){ clear(dmm).appendChild(msgEl(e.message,'err')); }); }})), dmm));
  function loadDom(){ api('GET','/admin/api/domain').then(function(d){ ip.textContent=d.publicIp||'-'; clear(hosts); var hs=(d.domain?[d.domain]:[]).concat(d.hosts||[]); hs.forEach(function(x,i){ hosts.appendChild(h('a',{href:'https://'+x,target:'_blank',rel:'noopener',text:x})); if(i<hs.length-1) hosts.appendChild(document.createTextNode(', ')); }); if(d.domain) dom.value=d.domain; }).catch(function(){}); }
  loadDom();
  var pc=h('input',{class:'input',type:'password',autocomplete:'current-password',placeholder:'Текущий пароль',style:'max-width:260px'}), pn=h('input',{class:'input',type:'password',autocomplete:'new-password',placeholder:'Новый пароль (от 10 символов)',style:'max-width:260px'}), pm=h('div');
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Пароль администратора'}), h('div',{class:'row'}, pc, pn, h('button',{class:'btn',text:'Сменить',onclick:function(){ api('POST','/admin/api/password',{current:pc.value,next:pn.value}).then(function(){ pc.value=''; pn.value=''; clear(pm).appendChild(msgEl('Пароль изменен','ok')); }).catch(function(e){ clear(pm).appendChild(msgEl(e.message,'err')); }); }})), pm));
  var al=h('div',{class:'feed'});
  pageEl.appendChild(h('section',{class:'card'}, h('h2',{text:'Журнал действий администратора'}), al));
  api('GET','/admin/api/audit').then(function(r){ r.audit.forEach(function(a){ al.appendChild(h('div',{class:'ev'}, h('time',{title:fdt(a.at),text:ago(a.at)}), h('div',null, AUD[a.action]||a.action, a.target?[h('span',{class:'muted'},' · '), a.first_name?h('button',{class:'linkbtn',text:fullName(a),onclick:function(){ openUser(a.target); }}):h('span',{class:'muted',text:'удаленный пользователь'})]:null, a.data&&a.data.count!=null?h('span',{class:'muted',text:' · записей: '+a.data.count}):null))); }); if(!r.audit.length) al.appendChild(h('p',{class:'empty',text:'Пока пусто'})); }).catch(function(){});
}

/* ---------- навигация ---------- */
function go(tab){ ST.tab=tab; try{ history.replaceState(null,'','/admin#'+tab); }catch(e){} renderTab(); }
function renderTab(){
  clearInterval(TIMER);
  Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.setAttribute('aria-selected', String(b.getAttribute('data-tab')===ST.tab)); });
  if(ST.tab==='activity') renderActivity(); else if(ST.tab==='users') renderUsers(); else if(ST.tab==='settings') renderSettings(); else renderOverview();
}
function startApp(){ APP=true; show('v-app'); api('GET','/admin/api/settings').then(function(r){ renderWarn(!r.settings.operatorName||!r.settings.supportText); }).catch(function(){}); var t=(location.hash||'').slice(1); ST.tab=['overview','activity','users','settings'].indexOf(t)>=0?t:'overview'; renderTab(); }
Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.addEventListener('click', function(){ go(b.getAttribute('data-tab')); }); });
document.addEventListener('keydown', function(e){ if(e.key==='Escape' && $('drawer').firstChild) closeUser(); });
function init(){
  api('GET','/admin/api/whoami').then(function(w){ $('ver').textContent='версия '+w.version;
    if(w.authed) return startApp();
    if(!w.configured) return show(setupCode&&w.setupPending?'v-setup':'v-nosetup');
    show('v-login'); }).catch(function(e){ show('v-login'); msg('m-login',e.message,true); });
}
$('f-setup').addEventListener('submit',function(ev){ ev.preventDefault(); if($('s-pw').value!==$('s-pw2').value) return msg('m-setup','Пароли не совпадают',true);
  api('POST','/admin/setup',{code:setupCode,password:$('s-pw').value}).then(function(){ history.replaceState(null,'','/admin'); setupCode=''; startApp(); }).catch(function(e){msg('m-setup',e.message,true);}); });
$('f-login').addEventListener('submit',function(ev){ ev.preventDefault(); api('POST','/admin/login',{password:$('l-pw').value}).then(function(){ $('l-pw').value=''; startApp(); }).catch(function(e){msg('m-login',e.message,true);}); });
$('logout').addEventListener('click',function(){ api('POST','/admin/logout').then(function(){ location.replace('/admin'); }); });
init();
})();
</script></body></html>`;
