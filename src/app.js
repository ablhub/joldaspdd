(function(){
'use strict';

/* ---------- data ---------- */
var D = window.__PDD || JSON.parse(document.getElementById('pdd-data').textContent);
/* язык сборки: ru (корень), kk (/kk/), en (/en/). Строки интерфейса переводятся при сборке (tools/i18n_ui.py) */
var LANG = D.lang || 'ru';
try{ document.documentElement.lang = LANG; }catch(e){}
var LANGS = (D.langs && D.langs.length && /^https?:$/.test(location.protocol)) ? D.langs : null;   // только сборка для сервера
var LANG_KEY = 'joldas-lang';
if(LANGS){ try{ document.documentElement.classList.add('has-langs'); }catch(e){} }   // место в шапке под переключатель языка
/* автопереход: на корневой русской странице сразу открываем язык, выбранный раньше (на /kk/ и /en/ не переходим) */
if(LANGS && LANG==='ru'){
  var langSaved=null; try{ langSaved=localStorage.getItem(LANG_KEY); }catch(e){}
  var langTo=LANGS.filter(function(l){ return l.code===langSaved && l.code!=='ru' && l.href; })[0];
  if(langTo){ location.replace(langTo.href+location.hash); return; }
}
var ALLMODS = D.modules.slice().sort(function(a,b){return a.order-b.order;});
var MOD = {}; ALLMODS.forEach(function(m){MOD[m.id]=m; m.qs=m.questions;});
var Q = {};
ALLMODS.forEach(function(m){m.questions.forEach(function(q){q.m=m.id; Q[q.id]=q;});});
var CORE_ALL = Object.keys(Q);
var CATDATA = D.categories||{groups:[],categories:[],autodrom:{},notes:[]};
var CATBY = {}; (CATDATA.categories||[]).forEach(function(c){ CATBY[c.code]=c; });
var CATORDER = ['A1','A','B1','B','BE','C1','C','C1E','CE','D1','D','D1E','DE','Tb','Tm'];
var CATSHORT = {A1:'легкие мотоциклы и мопеды',A:'мотоциклы',B1:'трициклы и квадроциклы',B:'легковые автомобили',BE:'легковой автомобиль с прицепом',C1:'средние грузовики',C:'грузовые автомобили',C1E:'средний грузовик с прицепом',CE:'грузовик с прицепом, седельный тягач',D1:'микроавтобусы',D:'автобусы',D1E:'микроавтобус с прицепом',DE:'автобус с прицепом, сочлененный автобус',Tb:'троллейбусы',Tm:'трамваи'};
var CATAGE = {A1:'16 лет',A:'18 лет',B1:'18 лет',B:'18 лет',BE:'после 12 мес. с B',C1:'18 лет',C:'21 год',C1E:'после 12 мес. с C или C1',CE:'после 12 мес. с C',D1:'21 год',D:'23 года',D1E:'после 12 мес. с D или D1',DE:'после 12 мес. с D',Tb:'23 года',Tm:'21 год'};
var CATEXP = {C:'3 года, из них 1 год на C1',D1:'3 года, из них 1 год на C1',D:'3 года, из них 1 год на D1',Tb:'3 года, из них 1 год на D1'};
var GSHORT = {A:'мотоциклы, мопеды, трициклы и квадроциклы',B:'легковые автомобили и прицепы к ним',C:'грузовые автомобили и автопоезда',D:'автобусы',T:'трамвай и троллейбус'};
var MODCATS = {m21:'A1, A, B1',m22:'C1, C, C1E, CE',m23:'D1, D, D1E, DE',m24:'BE, C1E, CE, D1E, DE',m25:'Tb, Tm'};
function catOptions(sel){ return CATORDER.filter(function(k){ return CATBY[k] || k==='B'; }).map(function(k){ return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+k+' - '+CATSHORT[k]+'</option>'; }).join(''); }
var MODS = [], CORE = [], G = 'B';
function groupOf(code){ var c=CATBY[code]; return c?c.group:'B'; }
function eligible(q){ return !q.cats || q.cats.indexOf(G)>=0; }
function mqs(m){ return (m.qs&&m.qs.length)?m.qs:m.questions; }
function num(m){ var i=MODS.indexOf(m); return i>=0?i+1:m.order; }
var SIGNS = D.signs; var SIGN = {}; SIGNS.forEach(function(s){SIGN[s.code]=s;});
var SIGNSVG = {}; SIGNS.forEach(function(s){ SIGNSVG[s.code]=s.svg; });
var P = D.practice;
var GROUPS = [];
/* s.group - русский ключ группы, s.gname - название группы на языке сборки; короткие подписи фильтров - значения GLABEL */
var GLABEL = {'Предупреждающие знаки':'Предупреждающие','Знаки приоритета':'Приоритета','Запрещающие знаки':'Запрещающие','Предписывающие знаки':'Предписывающие','Информационно-указательные знаки':'Информационные','Знаки сервиса':'Сервиса','Знаки дополнительной информации (таблички)':'Таблички'};
var GNAME = {};
SIGNS.forEach(function(s){ if(GROUPS.indexOf(s.group)<0) GROUPS.push(s.group); if(s.gname && !GNAME[s.group]) GNAME[s.group]=s.gname; });

function hash(str){var h=2166136261; for(var i=0;i<str.length;i++){h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0;}
function rng(seed){var s=seed||7; return function(){s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296;};}
function shuffle(a,r){r=r||Math.random; a=a.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(r()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t;} return a;}

/* generated sign-recognition questions (not part of readiness or the exam) */
SIGNS.forEach(function(s){
  var r = rng(hash('zn'+s.code));
  var same = SIGNS.filter(function(x){return x.code!==s.code && x.group===s.group && x.name!==s.name;});
  var other = SIGNS.filter(function(x){return x.code!==s.code && x.group!==s.group && x.name!==s.name;});
  var pool = shuffle(same,r).slice(0,3);
  if(pool.length<3) pool = pool.concat(shuffle(other,r).slice(0,3-pool.length));
  var opts = shuffle([s].concat(pool), r);
  var id = 'zn-'+s.code;
  Q[id] = {id:id, m:'zn', gen:true, sign:s.code, q:'Как называется этот знак?', options:opts.map(function(x){return x.name;}), answer:opts.indexOf(s), explain:s.meaning+(s.note?' '+s.note:''), ref:tpl('Прил. 1, знак {c}', {c:s.code}), difficulty:1};
});

/* ---------- картинки знаков рядом с текстом ----------
   Знак находим по номеру (знак 3.1, знаки 5.8.1 и 5.8.2, диапазон 2.4-2.6) и по названию в кавычках после слова «знак».
   Номера разметки (разметка 1.1, линия 1.3), классов опасных грузов (классы 2.2-2.4) и ссылки на пункты (п. 2.4) не трогаем: слова «разметка», «линия», «класс» переключают режим. */
var SIGNNAME = {}; (function(){ var cnt={}; SIGNS.forEach(function(s){ var k=String(s.name||'').toLowerCase(); cnt[k]=(cnt[k]||0)+1; SIGNNAME[k]=s.code; }); Object.keys(cnt).forEach(function(k){ if(cnt[k]>1) delete SIGNNAME[k]; }); })();
var SGRE = /(^|[^a-zа-яёәіңғүұқөһ])((?:знак|табличк|белгі)[а-яёәіңғүұқөһ]*|(?:signs?|plates?)(?![a-z]))|(^|[^a-zа-яёәіңғүұқөһ])((?:разметк|лини|таңбалама|сызық|класс|сынып)[а-яёәіңғүұқөһ]*|(?:markings?|lines?|class(?:es)?)(?![a-z]))|(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)(?:\s*-\s*(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?))?(?![\d]|\.\d)|[«“]([^«»“”]{2,60})[»”]/gi;
var UNITRE=/^\s*(?:м(?:етр[а-яёәіңғүұқөһ]*)?|км|т(?:онн[а-яёәіңғүұқөһ]*)?|кг|%|процент|мин(?:ут[а-яёәіңғүұқөһ]*)?|сек(?:унд[а-яёәіңғүұқөһ]*)?|с|ч(?:ас[а-яёәіңғүұқөһ]*)?|л|см|мм|град[а-яё]*|°|сағат[а-яёәіңғүұқөһ]*|m|meters?|metres?|km|t|tons?|tonnes?|kg|min(?:utes?)?|sec(?:onds?)?|s|h(?:ours?)?|l|cm|mm|percent)(?![a-zа-яёәіңғүұқөһ])/i;
function codeKey(c){ return c.split('.').map(Number); }
function keyCmp(a,b){ for(var i=0;i<Math.max(a.length,b.length);i++){ var d=(a[i]||0)-(b[i]||0); if(d) return d; } return 0; }
function codeRange(a,b){
  var ka=codeKey(a), kb=codeKey(b), out=[];
  if(ka.length!==kb.length || keyCmp(ka,kb)>0){ return [a,b].filter(function(c){ return SIGN[c]; }); }
  SIGNS.forEach(function(sg){ var k=codeKey(sg.code); if(k.length!==ka.length) return; for(var i=0;i<k.length-1;i++) if(k[i]!==ka[i]) return; if(keyCmp(k,ka)>=0 && keyCmp(k,kb)<=0) out.push(sg.code); });
  return out;
}
function findSigns(text, defMode){
  var res=[], seen={};
  if(!text) return res;
  String(text).split(/[.!?;:]\s+(?=[А-ЯЁӘІҢҒҮҰҚӨҺA-Z«(])|\n/).forEach(function(seg){
    var mode=defMode||'s', kw=false, re=new RegExp(SGRE.source,'gi'), m;
    while((m=re.exec(seg))){
      if(m[2]){ mode='s'; kw=true; }
      else if(m[4]){ mode='m'; }
      else if(m[5]){
        if(mode!=='s') continue;
        var pre=seg.slice(Math.max(0,m.index-8),m.index);
        if(/(?:п|пп|№|тармақ|тарм|clause|cl|item|para)\.?\s*$/i.test(pre)) continue;
        var post=seg.slice(re.lastIndex, re.lastIndex+14);
        if(UNITRE.test(post) || /^\s*[+=×*\/]/.test(post) || /[+=×*\/]\s*$/.test(pre) || /^-\d/.test(post)) continue;   /* 4.5 м, 2.5 т, 1.8 + 1.9, 1.5-2 минуты - это числа, а не знаки */
        (m[6]?codeRange(m[5],m[6]):(SIGN[m[5]]?[m[5]]:[])).forEach(function(c){ if(!seen[c]){ seen[c]=1; res.push(c); } });
      } else if(m[7] && kw){ var c2=SIGNNAME[m[7].toLowerCase()]; if(c2 && !seen[c2]){ seen[c2]=1; res.push(c2); } }
    }
  });
  return res;
}
function signThumbs(codes, cls){
  codes=(codes||[]).filter(function(c){ return SIGN[c] && SIGN[c].svg; }).slice(0,12);
  if(!codes.length) return '';
  return '<span class="zs'+(cls?' '+cls:'')+'">'+codes.map(function(c){ var sg=SIGN[c]; return '<span class="zi" title="'+esc(c+' '+sg.name)+'"><span class="zv" role="img" aria-label="'+esc(c+' '+sg.name)+'">'+sg.svg+'</span><span class="zc">'+esc(c)+'</span></span>'; }).join('')+'</span>';
}
function sceneCodes(q){   /* знаки, уже нарисованные на схеме вопроса */
  var o={}; try{ (function w(x){ if(typeof x==='string'){ var c=x.split(':')[0]; if(SIGN[c]) o[c]=1; } else if(x&&typeof x==='object'){ Object.keys(x).forEach(function(k){ w(x[k]); }); } })(q.scene&&q.scene.signs); }catch(e){}
  return o;
}
function qSigns(q, text, cls){ var sc=sceneCodes(q); return signThumbs(findSigns(text).filter(function(c){ return !sc[c] && c!==q.sign; }), cls); }

/* ---------- emblems ---------- */
var EMB = {m01:'book',m02:'wheel',m03:'5.16.1',m04:'1.8',m05:'tri',m06:'4.1.4',m07:'3.24',m08:'3.20',m09:'3.27',m10:'1.2',m11:'1.6',m12:'5.12',m13:'tow',m14:'cargo',m15:'4.5',m16:'6.1',m17:'law',m18:'2.4',m19:'marking',m20:'1.15',m21:'moto',m22:'truckc',m23:'busc',m24:'trailer',m25:'1.5'};
var BLUE = "<circle cx='50' cy='50' r='46' fill='#1D5BB8'/>";
var CUSTOM = {
  book: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<path d='M26 34c9-3 17-2 24 3v33c-7-5-15-6-24-3z' fill='#fff'/><path d='M74 34c-9-3-17-2-24 3v33c7-5 15-6 24-3z' fill='#fff'/><path d='M50 37v33' stroke='#1D5BB8' stroke-width='2'/></svg>",
  wheel: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<circle cx='50' cy='50' r='25' fill='none' stroke='#fff' stroke-width='7'/><circle cx='50' cy='50' r='6' fill='#fff'/><path d='M27 47h46M50 53v22' stroke='#fff' stroke-width='6'/></svg>",
  tri: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><path d='M50 10 L94 88 H6 Z' fill='#fff' stroke='#D52B1E' stroke-width='9' stroke-linejoin='round'/><path d='M50 42 L69 76 H31 Z' fill='none' stroke='#D52B1E' stroke-width='6' stroke-linejoin='round'/></svg>",
  tow: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<rect x='14' y='44' width='28' height='14' rx='4' fill='#fff'/><rect x='58' y='44' width='28' height='14' rx='4' fill='#fff'/><circle cx='21' cy='60' r='4' fill='#fff'/><circle cx='36' cy='60' r='4' fill='#fff'/><circle cx='65' cy='60' r='4' fill='#fff'/><circle cx='80' cy='60' r='4' fill='#fff'/><path d='M42 51h16' stroke='#fff' stroke-width='3' stroke-dasharray='3 2'/></svg>",
  cargo: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<path d='M28 40l22-10 22 10v24l-22 10-22-10z' fill='#fff'/><path d='M28 40l22 10 22-10M50 50v24' stroke='#1D5BB8' stroke-width='2.5' fill='none'/></svg>",
  law: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<path d='M50 26v44M36 74h28M28 36h44' stroke='#fff' stroke-width='5' stroke-linecap='round'/><path d='M28 38l-9 18h18zM72 38l-9 18h18z' fill='#fff'/></svg>",
  marking: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><rect x='6' y='6' width='88' height='88' rx='16' fill='#2A333C'/><path d='M34 12v76' stroke='#fff' stroke-width='5' stroke-dasharray='12 9'/><path d='M66 12v76' stroke='#F2B200' stroke-width='5'/></svg>",
  moto: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<circle cx='29' cy='62' r='11' fill='none' stroke='#fff' stroke-width='5'/><circle cx='71' cy='62' r='11' fill='none' stroke='#fff' stroke-width='5'/><path d='M29 62L42 45h17l12 17M42 45l-4-8h-8M59 45l4-10h8' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  truckc: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<rect x='16' y='34' width='40' height='26' rx='2' fill='#fff'/><path d='M56 42h14l10 10v8H56z' fill='#fff'/><rect x='60' y='45' width='9' height='7' fill='#1D5BB8'/><circle cx='28' cy='63' r='6' fill='#fff' stroke='#1D5BB8' stroke-width='2.5'/><circle cx='68' cy='63' r='6' fill='#fff' stroke='#1D5BB8' stroke-width='2.5'/></svg>",
  busc: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<rect x='27' y='22' width='46' height='50' rx='7' fill='#fff'/><rect x='32' y='28' width='36' height='18' rx='2' fill='#1D5BB8'/><circle cx='36' cy='62' r='4' fill='#1D5BB8'/><circle cx='64' cy='62' r='4' fill='#1D5BB8'/><rect x='31' y='72' width='8' height='7' rx='1.5' fill='#fff'/><rect x='61' y='72' width='8' height='7' rx='1.5' fill='#fff'/></svg>",
  trailer: "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>"+BLUE+"<rect x='12' y='44' width='36' height='14' rx='4' fill='#fff'/><rect x='19' y='35' width='20' height='11' rx='3' fill='#fff'/><rect x='57' y='38' width='30' height='20' rx='2' fill='#fff'/><path d='M48 53h9' stroke='#fff' stroke-width='3'/><circle cx='22' cy='60' r='5' fill='#fff' stroke='#1D5BB8' stroke-width='2.5'/><circle cx='39' cy='60' r='5' fill='#fff' stroke='#1D5BB8' stroke-width='2.5'/><circle cx='72' cy='60' r='5' fill='#fff' stroke='#1D5BB8' stroke-width='2.5'/></svg>"
};
function emblem(mid){ var k=EMB[mid]; if(SIGN[k]) return SIGN[k].svg; return CUSTOM[k]||CUSTOM.book; }

/* ---------- storage ---------- */
var KEY='joldas-pdd-v1';
var storageOK = true;
/* ONLINE: сборка для своего сервера (D.api) - обучение после бесплатной регистрации, прогресс в аккаунте */
var ONLINE = !!D.api && /^https?:$/.test(location.protocol);
var AUTH_KEY = 'joldas-auth-v1';
var AUTH = null;     // {token, user}
var CFG = null;      // публичные настройки: поддержка, оператор персональных данных
function loadAuth(){ try{ var a=JSON.parse(localStorage.getItem(AUTH_KEY)||'null'); if(a && a.token && a.user) return a; }catch(e){} return null; }
function saveAuth(a){ AUTH=a; try{ if(a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); }catch(e){} }
if(ONLINE){ AUTH=loadAuth(); try{ localStorage.removeItem('joldas-sync-v1'); }catch(e){} }
function guest(){ return ONLINE && !AUTH; }
function fresh(){ return {v:1, profile:{name:'',examDate:'',daily:30,cat:'B'}, q:{}, read:{}, exams:[], days:{}, adone:{}, chk:{}, exam:null, owner:'', trialUsed:false}; }
function load(){
  try{
    localStorage.setItem(KEY+'-t','1'); localStorage.removeItem(KEY+'-t');
    var raw = localStorage.getItem(KEY);
    if(!raw) return fresh();
    var o = JSON.parse(raw); var f = fresh();
    Object.keys(f).forEach(function(k){ if(o[k]===undefined) o[k]=f[k]; });
    o.profile = Object.assign(f.profile, o.profile||{});
    return o;
  }catch(e){ storageOK=false; return fresh(); }
}
var S = load();
if(ONLINE && S.owner && (!AUTH || AUTH.user.id!==S.owner)){ var tu0=S.trialUsed; S=fresh(); S.trialUsed=!!tu0; }   // прогресс другого аккаунта на этом устройстве не показываем
if(!S.profile.cat) S.profile.cat='B';
if(AUTH && AUTH.user && AUTH.user.category && !S.owner) S.profile.cat=AUTH.user.category;
function setGroup(){
  G=groupOf(S.profile.cat||'B'); MODS=[]; CORE=[];
  ALLMODS.forEach(function(m){ m.qs=m.questions.filter(eligible); if(m.qs.length) MODS.push(m); });
  MODS.forEach(function(m){ m.qs.forEach(function(q){ CORE.push(q.id); }); });
}
setGroup();
function setCat(c){ if(!CATBY[c] && c!=='B') return; S.profile.cat=c; S.profile.mt=Date.now(); if(AUTH){ AUTH.user.category=c; saveAuth(AUTH); } setGroup(); save(); SHEET=null; render(false); toast(tpl('Категория {c}: {n}', {c:c, n:qcount(CORE.length)})); }
var saveT = null;
function save(){ clearTimeout(saveT); saveT=setTimeout(flush,200); syncSoon(); }
function flush(){ clearTimeout(saveT); try{ localStorage.setItem(KEY, JSON.stringify(S)); storageOK=true; }catch(e){ storageOK=false; } }
window.addEventListener('pagehide', flush);

/* ---------- helpers ---------- */
var DAY = 86400000;
var INT = [0,1,3,7,16,35];
function pad(n){return (n<10?'0':'')+n;}
function dkey(ts){var d=new Date(ts); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function today(){return dkey(Date.now());}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/* скобочные ссылки на нормы в тексте, например «(п. 44)», «(44-т.)», «(para. 12(1))». В kk номера вида 38.3, 168-1
   и списки с диапазонами; в kk и en допускается один уровень вложенных скобок: «para. 2(9)», «CAO art. 590(1)» */
var REFRE = LANG==='kk' ? /\((?:\d+(?:[.-]\d+)*(?:,\s?\d+(?:[.-]\d+)*)*-тт?\.|\d-қосымша|ӘҚБтК|«Жол жүрісі туралы» Заң|Ақаулар тізбесі|Негізгі ережелер|Емтихан қабылдау|Көлік құралдарын пайдалануға|Жүргізушілердің|ЖЖҚ|ҚР алғашқы|Жүргізу техникасы|ERC|RC UK|ANZCOR|AHA|Highway Code)(?:[^()]|\([^()]{0,20}\)){0,90}\)/g
  : LANG==='en' ? /\((?:paras?\.|subparas?\.|Annex|CAO|Road Traffic Act|List of Defects|Basic Provisions|Examination Rules|Rules for|Kazakhstan First Aid|Driving technique|Drivers' Working|ERC|RC UK|ANZCOR|AHA|Highway Code)(?:[^()]|\([^()]{0,20}\)){0,90}\)/g
  : /\((?:п\.|пп\.|Прил\.|ст\.|Перечень|ПДД|Закон|ERC|RC UK)[^()]{0,70}\)/g;
function fmt(t){ return esc(t).replace(REFRE, function(m){return '<span class="ref">'+m+'</span>';}); }
/* формы слова после числа: ru - три формы, en - единственное/множественное, kk - после числа всегда единственное */
function plural(n,a,b,c){
  if(LANG==='en') return Math.abs(n)===1 ? a : c;
  if(LANG==='kk') return a;
  n=Math.abs(n)%100; var n1=n%10; if(n>10&&n<20) return c; if(n1>1&&n1<5) return b; if(n1===1) return a; return c;
}
/* шаблон фразы: tpl('Вопрос {i} из {n}', {i:5, n:40}). Шаблон переводится целиком, порядок слов задает переводчик */
function tpl(s, p){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return (p && p[k]!=null) ? String(p[k]) : m; }); }
function qcount(n){ return n+' '+plural(n,'вопрос','вопроса','вопросов'); }
function ofN(c, n){ return tpl('{c} из {n}', {c:c, n:n}); }
function pct(x){return Math.round(x*100);}
function mmss(sec){sec=Math.max(0,Math.round(sec)); return pad(Math.floor(sec/60))+':'+pad(sec%60);}
function fdate(ts){var d=new Date(ts); return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();}
var KEYS = ['1','2','3','4'];

function record(id, ok){
  var now=Date.now(); var r=S.q[id]; var first=!r;
  if(!r) r = S.q[id] = {a:0,c:0,box:0,due:0,t:0,ok:0};
  r.a++; r.t=now;
  if(ok){ r.c++; r.box = first ? 2 : Math.min(5, r.box+1); r.due = now + INT[r.box]*DAY; r.ok=1; }
  else { r.box=0; r.due=now; r.ok=0; }
  var k=today(); var d=S.days[k]||(S.days[k]={n:0,c:0}); d.n++; if(ok) d.c++;
  save();
}
function qscore(id){var r=S.q[id]; if(!r) return 0; if(!r.ok) return 0.15; return 0.5+0.5*Math.min(r.box,4)/4;}
function mastery(mid){var qs=mqs(MOD[mid]), s=0; if(!qs.length) return 0; qs.forEach(function(q){s+=qscore(q.id);}); return s/qs.length;}
function seen(mid){return mqs(MOD[mid]).filter(function(q){return !!S.q[q.id];}).length;}
function readiness(){
  var tot=0,w=0;
  MODS.forEach(function(m){var n=m.qs.length; tot+=mastery(m.id)*n; w+=n;});
  var base=w?tot/w:0; var ex=S.exams.slice(-3);
  if(ex.length){ var avg=ex.reduce(function(a,e){return a+e.c/e.n;},0)/ex.length; base=0.6*base+0.4*avg; }
  return Math.round(base*100);
}
function errorsList(){return Object.keys(S.q).filter(function(id){return Q[id] && S.q[id].a && !S.q[id].ok;});}
function dueList(){var now=Date.now(); return Object.keys(S.q).filter(function(id){return Q[id] && S.q[id].ok && S.q[id].due<=now;});}
function answeredCount(){return Object.keys(S.q).filter(function(id){return Q[id] && !Q[id].gen && eligible(Q[id]);}).length;}
function streak(){
  var n=0, t=Date.now();
  if(!S.days[dkey(t)]) t-=DAY;
  while(S.days[dkey(t)] && S.days[dkey(t)].n>0){ n++; t-=DAY; }
  return n;
}
function isWeak(mid){ return seen(mid)>=4 && mastery(mid)<0.5; }
function weakest(){
  var cand = MODS.filter(function(m){return S.read[m.id] || seen(m.id)>0;});
  if(!cand.length) return null;
  cand = cand.slice().sort(function(a,b){return mastery(a.id)-mastery(b.id);});
  return mastery(cand[0].id) < 0.85 ? cand[0] : null;
}
function daysLeft(){
  var ed=S.profile.examDate; if(!ed) return null;
  var t = new Date(ed+'T00:00:00').getTime(); if(isNaN(t)) return null;
  var d0 = new Date(today()+'T00:00:00').getTime();
  return Math.round((t-d0)/DAY);
}

/* ---------- plan ---------- */
function plan(){
  var tasks=[], errs=errorsList(), due=dueList(), k=today();
  var dayN=(S.days[k]||{n:0}).n, goal=S.profile.daily||30, any=Object.keys(S.q).length>0;
  if(errs.length||due.length){
    var eTxt = errs.length+' '+plural(errs.length,'ошибка','ошибки','ошибок');
    tasks.push({title:'Работа над ошибками', sub: due.length ? tpl('{e} и {d} на повторение', {e:eTxt, d:due.length}) : eTxt, act:'quiz', kind:'errors'});
  } else {
    tasks.push({done:any, title:'Работа над ошибками', sub: any?'Ошибок нет, повторять пока нечего':'Появится после первых ответов'});
  }
  var next = MODS.filter(function(m){return !S.read[m.id];})[0];
  if(next) tasks.push({title:tpl('Урок {n}. {t}', {n:num(next), t:next.title}), sub:tpl('{m} мин чтения и 10 вопросов', {m:next.minutes}), go:next.id});
  else tasks.push({done:true, title:tpl('Все {n} уроков пройдены', {n:MODS.length}), sub:'Перед экзаменом перечитайте блоки «Запомнить»'});
  var w = weakest();
  if(w) tasks.push({title:tpl('Слабая тема: {t}', {t:w.title}), sub:tpl('10 вопросов, освоено {p}%', {p:pct(mastery(w.id))}), act:'quiz', kind:'mod', mod:w.id});
  tasks.push({done:dayN>=goal, title:tpl('Цель дня: {n}', {n:qcount(goal)}), sub:tpl('Решено сегодня: {n}', {n:dayN}), act:'quiz', kind:'smart', prog:Math.min(1,dayN/goal)});
  var examToday = S.exams.some(function(e){return dkey(e.ts)===k;});
  var dl = daysLeft();
  if(readiness()>=40 || examToday || (dl!==null && dl<=5)){
    tasks.push({done:examToday, title:'Пробный экзамен', sub: examToday?'Сегодня уже решали':'40 вопросов за 40 минут, как в спецЦОН', go:'exam'});
  }
  return tasks;
}
function scheduleText(){
  var dl = daysLeft();
  if(dl===null) return 'Укажите дату экзамена, и план подстроится под ваш срок.';
  var unread = MODS.filter(function(m){return !S.read[m.id];}).length;
  var unseen = CORE.filter(function(id){return !S.q[id];}).length;
  if(dl<0) return 'Дата экзамена прошла. Если пересдаете, укажите новую.';
  if(dl===0) return 'Экзамен сегодня. Новые темы не начинайте: повторите ошибки и блоки «Запомнить». Удачи!';
  var studyDays = Math.max(1, dl-2);
  var lpd = Math.ceil(unread/studyDays), qpd = Math.max(20, Math.ceil(unseen/studyDays));
  var t = tpl('До экзамена {n}.', {n:dl+' '+plural(dl,'день','дня','дней')})+' ';
  if(unread) t += tpl('Проходите {l} и около {q} вопросов в день.', {l:lpd+' '+plural(lpd,'урок','урока','уроков'), q:qpd})+' ';
  else t += 'Все уроки пройдены: решайте пробные экзамены и закрывайте ошибки. ';
  if(dl>2) t += 'Последние 2 дня оставьте на пробные экзамены.';
  return t;
}

/* ---------- routing ---------- */
var VIEWS = ['plan','learn','signs','train','errors','exam','practice','about','profile','privacy','register','login'];
var OPEN_VIEWS = ['plan','about','privacy','register','login','exam','examrun','examres'];   // доступны гостю
var R = parseHash();
function parseHash(){ var h=(location.hash||'').slice(1); if(MOD[h]) return {v:'lesson',p:h}; if(VIEWS.indexOf(h)>=0) return {v:h}; return {v:'plan'}; }
function go(v,p){
  if(MOD[v]){ p=v; v='lesson'; }
  R={v:v,p:p||null};
  var tok = v==='lesson'?p:(VIEWS.indexOf(v)>=0?v:null);
  if(tok && location.hash.slice(1)!==tok){ try{ location.hash = tok; }catch(e){} }
  render(); window.scrollTo(0,0);
}
window.addEventListener('hashchange', function(){ var r=parseHash(); if(r.v!==R.v || r.p!==R.p){ if(R.v==='quiz'||R.v==='examrun'||R.v==='examres'){ if(r.v===prevV.v && r.p===prevV.p) return; } R=r; render(); window.scrollTo(0,0);} });
var prevV = {v:'plan',p:null};

/* ---------- state for sessions ---------- */
var QS = null;       // quiz session
var RES = null;      // last exam result
var SG = {g:'all', q:''};
var PT = 'exam';     // practice tab
var OPEN = {};       // opened autodrom items
var ASK = {finish:false, reset:false};
var OVER = null;     // sign overlay code
var SHEET = null;    // 'acct' | 'cat': меню аккаунта и выбор категории
var BUSY = false;    // идет запрос формы входа или регистрации

/* ---------- icons ---------- */
var IC = {
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/></svg>',
  learn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5C6 4.5 9 4.8 12 7v12c-3-2.2-6-2.5-9-1.5z"/><path d="M21 5.5C18 4.5 15 4.8 12 7v12c3-2.2 6-2.5 9-1.5z"/></svg>',
  train:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 9l2 2 4-4M8 15.5h8"/></svg>',
  exam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/></svg>',
  practice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.5h6.2M14 10.5h6.2M12 14v6.5"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1.2-4 4.1-6 7.5-6s6.3 2 7.5 6"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};
var CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

/* ---------- nav ---------- */
function navHTML(){
  var e=guest()?0:errorsList().length;
  var items = guest() ? [['plan','Главная'],['exam','Пробный тест'],['about','О проекте']]
    : [['plan','Мой план'],['learn','Учебник'],['signs','Знаки'],['train','Тренировка'],['errors','Ошибки'],['exam','Экзамен'],['practice','Практика']].concat(AUTH?[]:[['about','О проекте']]);
  var cur = curNav();
  document.getElementById('nav').innerHTML = items.map(function(it){
    return '<button data-go="'+it[0]+'"'+(cur===it[0]?' aria-current="page"':'')+'>'+it[1]+(it[0]==='errors'&&e?' <span class="badge red">'+e+'</span>':'')+'</button>';
  }).join('');
  var b = guest() ? [['plan','Главная','plan'],['exam','Пробный тест','exam'],['register','Регистрация','user']]
    : [['plan','План','plan'],['learn','Учебник','learn'],['train','Тесты','train'],['exam','Экзамен','exam'],['practice','Практика','practice']];
  var bc = cur==='signs'?'learn':(cur==='errors'?'train':(cur==='login'?'register':cur));
  var bn=document.getElementById('bnav');
  bn.style.gridTemplateColumns='repeat('+b.length+',1fr)';
  bn.innerHTML = b.map(function(it){
    return '<button data-go="'+it[0]+'"'+(bc===it[0]?' aria-current="page"':'')+'>'+IC[it[2]]+'<span>'+it[1]+'</span>'+(it[0]==='train'&&e?'<span class="dot">'+(e>99?'99+':e)+'</span>':'')+'</button>';
  }).join('');
  var ac=document.getElementById('acct');
  if(ac){
    if(!ONLINE) ac.innerHTML=langHTML();
    else if(!AUTH) ac.innerHTML=langHTML()+'<button class="btn ghost sm" data-go="login">Войти</button><button class="btn primary sm hide-xs" data-go="register">Регистрация</button>';
    else { var u=AUTH.user; ac.innerHTML=langHTML()+'<button class="acctbtn" data-act="acct" aria-haspopup="dialog" aria-expanded="'+(SHEET==='acct')+'" aria-label="Мой аккаунт"><span class="ava" aria-hidden="true">'+esc(initials(u))+'</span><span class="acct-n">'+esc(u.firstName)+'</span><span class="acct-c">'+esc(S.profile.cat)+'</span></button>'; }
  }
}
/* переключатель языка «Қаз · Рус · Eng» (только сборка для сервера: D.langs) */
function langHTML(){
  if(!LANGS) return '';
  return '<div class="langsw" role="group" aria-label="Язык сайта">'+LANGS.map(function(l){
    return '<button type="button" data-act="lang" data-code="'+esc(l.code)+'" lang="'+esc(l.code)+'"'+(l.code===LANG?' aria-current="true"':'')+'>'+esc(l.label)+'</button>';
  }).join('')+'</div>';
}
function setLang(code){
  var l=(LANGS||[]).filter(function(x){ return x.code===code; })[0]; if(!l) return;
  try{ localStorage.setItem(LANG_KEY, code); }catch(e){}
  if(code===LANG || !l.href) return;
  if(AUTH){ try{ apiCall('PATCH','/me',{lang:code}, null, true).catch(function(){}); }catch(e){} }
  flush();
  location.href = l.href + location.hash;
}
function initials(u){ return ((u.firstName||'').charAt(0)+(u.lastName||'').charAt(0)).toUpperCase()||'?'; }
function curNav(){
  if(R.v==='lesson') return 'learn';
  if(R.v==='quiz') return QS&&QS.from ? QS.from : 'train';
  if(R.v==='examrun'||R.v==='examres') return 'exam';
  return R.v;
}

/* ---------- banners ---------- */
function liveHTML(){
  var h='';
  if(S.exam && R.v!=='examrun'){
    h+='<div class="live"><span>'+tpl('Идет пробный экзамен. Осталось {t}', {t:'<b data-timer>'+mmss(examLeft())+'</b>'})+'</span><button class="btn yellow" data-act="ex-resume">Вернуться к экзамену</button></div>';
  }
  if(QS && !QS.done && R.v!=='quiz'){
    h+='<div class="live"><span>'+tpl('{t}: вопрос <b>{i} из {n}</b>', {t:esc(QS.title), i:QS.i+1, n:QS.ids.length})+'</span><button class="btn yellow" data-act="q-resume">Продолжить</button><button class="btn" data-act="q-drop">Закончить</button></div>';
  }
  if(!storageOK) h+='<div class="live"><span>Браузер не дает сохранять данные в этом окне: прогресс пропадет после закрытия страницы.</span></div>';
  return h;
}

/* ---------- views ---------- */
function gauge(v){
  var cx=110, cy=112, r=88;
  function pt(p,rr){var a=Math.PI*(1-p/100); return [cx+rr*Math.cos(a), cy-rr*Math.sin(a)];}
  var s='<svg class="gauge" viewBox="0 0 220 128" role="img" aria-label="'+esc(tpl('Готовность {v} процентов', {v:v}))+'">';
  s+='<path class="track" d="M'+(cx-r)+' '+cy+' A'+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+'"/>';
  if(v>0){var e=pt(Math.min(v,100),r); s+='<path class="val" d="M'+(cx-r)+' '+cy+' A'+r+' '+r+' 0 0 1 '+e[0].toFixed(1)+' '+e[1].toFixed(1)+'"/>';}
  for(var i=0;i<=100;i+=5){ var major=i%20===0; var a=pt(i,r-12), b=pt(i,major?r-24:r-18); s+='<line class="tick'+(major?' major':'')+'" x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'"/>'; if(major){var l=pt(i,r-34); s+='<text class="tl" x="'+l[0].toFixed(1)+'" y="'+(l[1]+3).toFixed(1)+'" text-anchor="middle">'+i+'</text>';} }
  var p1=pt(80,r-9), p2=pt(80,r+9), pl=pt(80,r+19);
  s+='<line class="pass" x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'"/>';
  s+='<text class="passl" x="'+pl[0].toFixed(1)+'" y="'+(pl[1]+2).toFixed(1)+'" text-anchor="middle">32/40</text>';
  var n=pt(Math.min(v,100),r-30);
  s+='<line class="needle" x1="'+cx+'" y1="'+cy+'" x2="'+n[0].toFixed(1)+'" y2="'+n[1].toFixed(1)+'"/><circle class="hub" cx="'+cx+'" cy="'+cy+'" r="6"/>';
  return s+'</svg>';
}
function verdict(v){
  var last=S.exams[S.exams.length-1];
  if(!answeredCount()) return 'Начните с первого урока: стрелка поползет вверх';
  if(v>=80 && last && last.c>=32) return 'Готовы к экзамену. Держите форму';
  if(v>=80) return 'Почти готовы. Сдайте пробный экзамен';
  if(v>=55) return 'Хороший темп. Закройте слабые темы';
  return 'Идет подготовка. Решайте каждый день';
}

function viewPlan(){
  var v=readiness(), any=answeredCount()>0, dl=daysLeft();
  var h='';
  var nm = AUTH ? AUTH.user.firstName : S.profile.name, catLine = catLineHTML();
  h+='<section class="hero'+(any?' compact':'')+'">';
  if(any){
    h+='<h1>'+(nm?tpl('Сәлем, {name}!', {name:esc(nm)}):'Сәлем!')+' Продолжаем подготовку</h1>';
    h+='<p style="margin-top:6px">'+tpl('Категория {c} · {n}', {c:esc(S.profile.cat), n:qcount(CORE.length)})+' · <button class="linkbtn" data-act="cat-sheet">сменить</button></p>';
  } else if(AUTH){
    h+='<p class="eyebrow" style="color:#F5C33B">Ваш план подготовки</p>';
    h+='<h1>'+tpl('Сәлем, {name}! Всё готово к подготовке', {name:esc(nm)})+'</h1>';
    h+='<p>'+tpl('Учебник, {n} для вашей категории, работа над ошибками и симулятор экзамена уже открыты. Укажите дату экзамена, и план на каждый день подстроится под ваш срок.', {n:qcount(CORE.length)})+'</p>';
    h+=catLine;
    h+='<div class="row"><button class="btn yellow" data-go="m01">Начать с урока 1</button><button class="btn" data-go="exam">Пробный экзамен</button></div>';
  } else {
    h+='<p class="eyebrow" style="color:#F5C33B">ПДД РК 2026 · все категории, от A1 до Tm</p>';
    h+='<h1>Полная подготовка к экзамену на права, <em>построенная под вас</em></h1>';
    h+='<p>'+tpl('Личный план по дате экзамена, учебник по актуальным ПДД Казахстана, {n} с разбором и схемами ситуаций, работа над ошибками, симулятор экзамена спецЦОН и практика автодрома.', {n:qcount(CORE_ALL.length)})+'</p>';
    h+='<div class="facts"><span class="fact"><b>40</b> вопросов</span><span class="fact"><b>40</b> минут</span><span class="fact">не больше <b>8</b> ошибок</span><span class="fact"><b>15</b> категорий</span></div>';
    h+=catLine;
    h+='<div class="row"><button class="btn yellow" data-go="m01">Начать с урока 1</button><button class="btn" data-go="exam">Пробный экзамен</button></div>';
  }
  h+='</section>';

  h+='<div class="home" style="margin-top:20px">';
  /* left column */
  h+='<div class="stack">';
  h+='<div class="card"><div class="card-h"><h2 class="h2">Готовность</h2>'+(dl!==null&&dl>=0?'<span class="badge yellow">'+tpl('до экзамена {n}', {n:dl+' '+plural(dl,'день','дня','дней')})+'</span>':'')+'</div>';
  h+='<div class="gauge-wrap">'+gauge(v)+'<div class="gauge-num">'+v+'<small>%</small></div><p class="verdict">'+esc(verdict(v))+'</p><p class="small muted" style="margin-top:4px">Желтая отметка - проходной порог спецЦОН: 32 из 40</p></div></div>';

  var k=today(), dayN=(S.days[k]||{n:0}).n;
  h+='<div class="kpis">';
  h+='<div class="kpi"><div class="n">'+dayN+'</div><div class="l">решено сегодня</div></div>';
  h+='<div class="kpi"><div class="n">'+streak()+'</div><div class="l">'+plural(streak(),'день','дня','дней')+' подряд</div></div>';
  h+='<div class="kpi"><div class="n">'+answeredCount()+'<span class="muted" style="font-size:.8rem">/'+CORE.length+'</span></div><div class="l">вопросов пройдено</div></div>';
  var passed=S.exams.filter(function(e){return e.c>=32;}).length;
  h+='<div class="kpi"><div class="n">'+passed+'<span class="muted" style="font-size:.8rem">/'+S.exams.length+'</span></div><div class="l">экзаменов сдано</div></div>';
  h+='</div>';

  /* profile */
  var pr=S.profile, openForm = !pr.examDate;
  h+='<div class="card flat"><div class="card-h"><h2 class="h3">'+(AUTH?'Мой план подготовки':'Мой профиль')+'</h2>'+(openForm?'':'<button class="btn ghost sm" data-act="edit-profile">Изменить</button>')+'</div>';
  if(openForm || ASK.profile){
    h+='<form id="pf" class="stack" style="gap:12px"><div class="form-grid">';
    if(!AUTH) h+='<div class="field"><label for="pf-name">Имя</label><input class="input" id="pf-name" maxlength="30" autocomplete="given-name" value="'+esc(pr.name)+'" placeholder="Как к вам обращаться"></div>';
    h+='<div class="field"><label for="pf-date">Дата экзамена</label><input class="input" type="date" id="pf-date" value="'+esc(pr.examDate)+'"></div>';
    h+='<div class="field"><label>Вопросов в день</label><div class="seg" role="group" aria-label="Вопросов в день">'+[20,30,50].map(function(n){return '<button type="button" data-act="pf-daily" data-n="'+n+'" aria-pressed="'+((pr.daily||30)===n)+'">'+n+'</button>';}).join('')+'</div></div>';
    h+='</div><p class="small">'+tpl('Категория {c}', {c:'<b>'+esc(pr.cat||'B')+'</b>'})+' · '+esc(CATSHORT[pr.cat||'B']||'')+' <button type="button" class="btn ghost sm" data-act="cat-sheet">Сменить</button></p>';
    h+='<div class="row"><button class="btn primary" type="submit">Сохранить план</button><span class="small muted">'+(AUTH?'Сохраняется в вашем аккаунте':'Данные остаются в вашем браузере')+'</span></div></form>';
  } else {
    h+='<p>'+(!AUTH&&pr.name?esc(pr.name)+' · ':'')+tpl('категория {c} · экзамен {d} · цель {n} вопросов в день', {c:esc(pr.cat||'B'), d:esc(pr.examDate.split('-').reverse().join('.')), n:(pr.daily||30)})+'</p>';
  }
  h+='</div>';
  h+='</div>';

  /* right column */
  h+='<div class="stack">';
  h+='<div class="card"><div class="card-h"><h2 class="h2">План на сегодня</h2><span class="small muted">'+esc(fdate(Date.now()))+'</span></div>';
  h+='<p class="small muted" style="margin-bottom:12px">'+esc(scheduleText())+'</p><div class="tasks">';
  plan().forEach(function(t){
    var attrs = t.go?' data-go="'+t.go+'"':(t.act?' data-act="'+t.act+'" data-kind="'+(t.kind||'')+'" data-mod="'+(t.mod||'')+'"':'');
    h+='<div class="task'+(t.done?' done':'')+'"><span class="chk" aria-hidden="true"></span><div class="t"><b>'+esc(t.title)+'</b><span>'+esc(t.sub)+'</span>'+(t.prog!==undefined&&!t.done?'<div class="bar yellow" style="margin-top:6px;max-width:220px"><i style="width:'+pct(t.prog)+'%"></i></div>':'')+'</div>'+((t.go||t.act)&&!t.done?'<button class="btn sm"'+attrs+'>Начать</button>':((t.go||t.act)?'<button class="btn ghost sm"'+attrs+'>Еще раз</button>':''))+'</div>';
  });
  h+='</div></div>';

  h+='<div class="card"><div class="card-h"><h2 class="h2">Темы</h2><button class="btn ghost sm" data-go="learn">Весь учебник</button></div><div class="topics">';
  MODS.forEach(function(m){
    var ms=mastery(m.id), weak=isWeak(m.id);
    h+='<button class="topic" data-go="'+m.id+'"><span class="emb">'+emblem(m.id)+'</span><span class="nm">'+num(m)+'. '+esc(m.title)+(weak?' <span class="badge red">слабая</span>':'')+(S.read[m.id]&&!weak?' <span class="badge">прочитано</span>':'')+'</span><span class="bar'+(ms>=0.8?' green':'')+'"><i style="width:'+pct(ms)+'%"></i></span><span class="pc">'+pct(ms)+'%</span></button>';
  });
  h+='</div></div>';

  if(S.exams.length){
    var ex=S.exams.slice(-12);
    h+='<div class="card"><div class="card-h"><h2 class="h2">Пробные экзамены</h2><button class="btn ghost sm" data-go="exam">Новый</button></div>';
    h+='<div class="hist" aria-label="Результаты последних экзаменов"><div class="line" style="bottom:80%"><span>32</span></div>';
    ex.forEach(function(e){ h+='<div class="b'+(e.c>=32?' ok':'')+'" style="height:'+Math.max(4,pct(e.c/e.n))+'%" title="'+esc(fdate(e.ts)+': '+ofN(e.c, e.n))+'"></div>'; });
    var lx=ex[ex.length-1];
    h+='</div><p class="small muted" style="margin-top:8px">'+tpl('Последний: {c} из {n}, {d}', {c:lx.c, n:lx.n, d:fdate(lx.ts)})+'</p></div>';
  }

  if(AUTH){
    h+='<div class="card flat"><div class="card-h"><h2 class="h3">Аккаунт</h2><button class="btn ghost sm" data-go="profile">Профиль</button></div><p class="small muted">'+tpl('Прогресс сохраняется в аккаунте {p} и доступен на любом устройстве: просто войдите по номеру и паролю.', {p:'<b>'+esc(fmtPhone(AUTH.user.phone))+'</b>'})+' <span id="sync-st" aria-live="polite">'+esc(syncStatus())+'</span></p></div>';
  } else {
    h+='<details class="card flat" id="xfer-box"'+(ASK.xferOpen||ASK.reset?' open':'')+'><summary class="h3" style="cursor:pointer">Перенос прогресса и сброс</summary><div class="stack" style="gap:12px;margin-top:14px">';
    h+='<p class="small muted">Прогресс хранится в этом браузере. Чтобы продолжить на другом устройстве, скопируйте код и вставьте его там.</p>';
    h+='<div class="row"><button class="btn sm" data-act="export">Показать код прогресса</button><button class="btn sm" data-act="copy">Скопировать</button></div>';
    h+='<textarea class="input" id="xfer" aria-label="Код прогресса" placeholder="Сюда появится код, или вставьте код с другого устройства"></textarea>';
    h+='<div class="row"><button class="btn sm" data-act="import">Загрузить код</button>'+resetRow()+'</div>';
    h+='</div></details>';
  }
  h+='</div></div>';
  return h;
}

function modCard(m, foreign){
  var ms=mastery(m.id), n=foreign?m.questions.length:m.qs.length;
  var tag = m.order<=20 ? esc(m.pdd.toUpperCase()) : 'ОСОБЕННОСТИ КАТЕГОРИИ';
  var h='<button class="mod'+(foreign?' foreign':'')+'" data-go="'+m.id+'"><div class="top-row"><span class="emb">'+emblem(m.id)+'</span><div><div class="num">'+(foreign?tpl('ДЛЯ {c}', {c:esc(MODCATS[m.id]||'')}):tpl('ТЕМА {n}', {n:num(m)})+' · '+tag)+'</div><h3>'+esc(m.title)+'</h3></div></div>';
  h+='<div class="meta"><span>'+tpl('{m} мин', {m:m.minutes})+'</span><span>·</span><span>'+qcount(n)+'</span>'+(S.read[m.id]?'<span class="badge green">прочитано</span>':'')+(!foreign&&isWeak(m.id)?'<span class="badge red">слабая</span>':'')+(!foreign&&m.order>20?'<span class="badge blue">'+tpl('категория {c}', {c:esc(S.profile.cat)})+'</span>':'')+'</div>';
  if(!foreign) h+='<div class="bar'+(ms>=0.8?' green':'')+'"><i style="width:'+pct(ms)+'%"></i></div>';
  return h+'</button>';
}
function viewLearn(){
  var cat=S.profile.cat||'B', read=MODS.filter(function(m){return S.read[m.id];}).length;
  var other=ALLMODS.filter(function(m){return MODS.indexOf(m)<0;}), ad=autodromSet();
  var h='<div class="stack" style="gap:6px;margin-bottom:22px"><p class="eyebrow">Учебник · '+tpl('категория {c}', {c:esc(cat)})+'</p><h1 class="h1">'+tpl('{n} по ПДД РК', {n:MODS.length+' '+plural(MODS.length,'тема','темы','тем')})+'</h1><p class="lead">Каждая тема - объяснение простыми словами, блок «Запомнить» с цифрами и ссылками на пункты Правил, частые ошибки и вопросы для самопроверки. '+tpl('Для категории {c} подобрано {n}. Прочитано: {r} из {t}.', {c:esc(cat), n:qcount(CORE.length), r:read, t:MODS.length})+'</p></div>';
  h+='<div class="mods">';
  MODS.forEach(function(m){ h+=modCard(m, false); });
  h+='<button class="mod" data-go="signs"><div class="top-row"><span class="emb">'+SIGN['2.1'].svg+'</span><div><div class="num">СПРАВОЧНИК · ПРИЛОЖЕНИЕ 1</div><h3>Каталог дорожных знаков</h3></div></div><div class="meta"><span>'+tpl('{n} с объяснением и тренажером', {n:SIGNS.length+' '+plural(SIGNS.length,'знак','знака','знаков')})+'</span></div></button>';
  h+='<button class="mod" data-go="practice"><div class="top-row"><span class="emb">'+CUSTOM.wheel+'</span><div><div class="num">'+tpl('ПРАКТИКА · КАТЕГОРИЯ {c}', {c:esc(cat)})+'</div><h3>Автодром, город и путь к правам</h3></div></div><div class="meta"><span>'+(ad.list.length?tpl('{n} автодрома, требования категории, город, чек-листы', {n:ad.list.length+' '+plural(ad.list.length,'упражнение','упражнения','упражнений')}):'требования категории, город, чек-листы')+'</span></div></button>';
  h+='</div>';
  if(other.length){
    h+='<details class="card flat" style="margin-top:28px"><summary class="h3" style="cursor:pointer">Темы для других категорий ('+other.length+')</summary><p class="small muted" style="margin:10px 0 14px">Их можно читать и решать, но в план, шкалу готовности и экзамен они не входят. Сменить свою категорию: <button class="btn ghost sm" data-act="cat-sheet">выбрать категорию</button></p><div class="mods">';
    other.forEach(function(m){ h+=modCard(m, true); });
    h+='</div></details>';
  }
  return h;
}

function viewLesson(mid){
  var m=MOD[mid]; if(!m) return viewLearn();
  var idx=MODS.indexOf(m), foreign=idx<0, prev=idx>0?MODS[idx-1]:null, next=idx>=0?MODS[idx+1]:null, ms=mastery(mid), nq=mqs(m).length;
  var h='<div class="crumbs"><button data-go="learn">Учебник</button><span>/</span><span>'+(foreign?'Другие категории':tpl('Тема {n}', {n:num(m)}))+'</span></div>';
  h+='<div class="row" style="align-items:flex-start;gap:16px;margin-bottom:8px"><span class="emb" style="width:64px;height:64px;flex:none">'+emblem(mid)+'</span><div style="flex:1;min-width:0"><h1 class="h1">'+esc(m.title)+'</h1><p class="small muted" style="margin-top:6px">'+esc(m.pdd)+' · '+tpl('{m} мин', {m:m.minutes})+' · '+qcount(nq)+' · '+tpl('освоено {p}%', {p:pct(ms)})+'</p></div></div>';
  if(foreign) h+='<div class="tip" style="margin-bottom:16px"><b>'+tpl('Тема для категорий {c}', {c:esc(MODCATS[mid]||'')})+'</b>'+tpl('Ваша категория {c}. Тему можно читать и решать, но в план и экзамен она не входит.', {c:esc(S.profile.cat)})+' <button class="btn ghost sm" data-act="cat-sheet">Сменить категорию</button></div>';
  h+='<p class="lead" style="margin-bottom:18px">'+fmt(m.summary)+'</p>';
  h+='<div class="lesson"><article class="article">';
  var dm = mid==='m19' ? 'm' : 's';   /* в теме про разметку номера без слова «знак» - это линии разметки */
  m.lesson.forEach(function(b){
    h+='<section><h3>'+esc(b.h)+'</h3>';
    (b.p||[]).forEach(function(p){h+='<p>'+fmt(p)+signThumbs(findSigns(p,dm))+'</p>';});
    if(b.list&&b.list.length) h+='<ul>'+b.list.map(function(li){return '<li>'+fmt(li)+signThumbs(findSigns(li,dm),'inl')+'</li>';}).join('')+'</ul>';
    if(b.tip) h+='<div class="tip"><b>Для экзамена</b>'+fmt(b.tip)+signThumbs(findSigns(b.tip,dm))+'</div>';
    h+='</section>';
  });
  h+='<section><div class="row"><button class="btn primary" data-act="quiz" data-kind="lesson" data-mod="'+mid+'">Проверить себя: 10 вопросов</button>'+(S.read[mid]?'<span class="badge green">тема прочитана</span>':'<button class="btn" data-act="read" data-mod="'+mid+'">Отметить как прочитанное</button>')+'</div></section>';
  h+='<section class="row" style="justify-content:space-between">'+(prev?'<button class="btn ghost" data-go="'+prev.id+'">← '+esc(prev.title)+'</button>':'<span></span>')+(next?'<button class="btn ghost" data-go="'+next.id+'">'+esc(next.title)+' →</button>':'')+'</section>';
  h+='</article><aside class="aside">';
  h+='<div class="infosign"><h4>Запомнить</h4><ul>'+m.keyFacts.map(function(k){return '<li>'+esc(k)+signThumbs(findSigns(k,dm),'inl')+'</li>';}).join('')+'</ul></div>';
  if(m.mistakes&&m.mistakes.length) h+='<div class="warnbox"><h4>Частые ошибки</h4><ul>'+m.mistakes.map(function(k){return '<li>'+fmt(k)+signThumbs(findSigns(k,dm),'inl')+'</li>';}).join('')+'</ul></div>';
  h+='<div class="card flat stack" style="gap:10px"><button class="btn primary" data-act="quiz" data-kind="lesson" data-mod="'+mid+'">10 вопросов по теме</button><button class="btn" data-act="quiz" data-kind="modall" data-mod="'+mid+'">Все вопросы темы ('+nq+')</button>'+(mid==='m18'?'<button class="btn" data-go="signs">Каталог знаков</button><button class="btn" data-act="quiz" data-kind="signs">Тренажер знаков</button>':'')+'</div>';
  h+='</aside></div>';
  return h;
}

function signCard(s){ return '<button class="sg" data-act="sign" data-code="'+esc(s.code)+'"><span class="pic">'+s.svg+'</span><span class="cd">'+esc(s.code)+'</span><span class="nm">'+esc(s.name)+'</span></button>'; }
function signsGrid(){
  var q=SG.q.trim().toLowerCase();
  var list=SIGNS.filter(function(s){ return (SG.g==='all'||s.group===SG.g) && (!q || (s.code+' '+s.name+' '+s.meaning).toLowerCase().indexOf(q)>=0); });
  if(!list.length) return '<p class="muted">Ничего не найдено. Попробуйте номер знака, например 2.4.</p>';
  return '<div class="signs">'+list.map(signCard).join('')+'</div>';
}
function viewSigns(){
  var h='<div class="stack" style="gap:6px;margin-bottom:18px"><p class="eyebrow">Справочник</p><h1 class="h1">Дорожные знаки</h1><p class="lead">'+tpl('{n}, которые чаще всего встречаются в экзаменационных вопросах. Нажмите на знак, чтобы прочитать, что он требует и где действует.', {n:SIGNS.length+' '+plural(SIGNS.length,'знак','знака','знаков')})+'</p></div>';
  h+='<div class="row" style="margin-bottom:14px"><input class="input" id="sg-q" type="search" placeholder="Поиск: номер или название" value="'+esc(SG.q)+'" style="max-width:320px" aria-label="Поиск знака"><button class="btn primary" data-act="quiz" data-kind="signs">Тренажер знаков: 15 вопросов</button></div>';
  h+='<div class="chips" style="margin-bottom:18px"><button class="chip" data-act="sgroup" data-g="all" aria-pressed="'+(SG.g==='all')+'">Все</button>'+GROUPS.map(function(g){return '<button class="chip" data-act="sgroup" data-g="'+esc(g)+'" aria-pressed="'+(SG.g===g)+'">'+esc(GLABEL[g]||GNAME[g]||g)+'</button>';}).join('')+'</div>';
  h+='<div id="sg-grid">'+signsGrid()+'</div>';
  return h;
}
function overlayHTML(){
  if(!OVER) return '';
  var s=SIGN[OVER]; if(!s) return '';
  var r=S.q['zn-'+s.code];
  return '<div class="overlay" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(s.name)+'"><span class="pic" style="display:block">'+s.svg+'</span><p class="eyebrow" style="text-align:center">'+esc(s.gname||s.group)+' · '+esc(s.code)+'</p><h2 class="h2" style="text-align:center;margin:6px 0 12px">'+esc(s.name)+'</h2><p>'+fmt(s.meaning)+'</p>'+(s.note?'<p class="small muted" style="margin-top:10px">'+fmt(s.note)+'</p>':'')+(r?'<p class="small" style="margin-top:10px">В тренажере: '+(r.ok?'<span class="badge green">узнаете</span>':'<span class="badge red">была ошибка</span>')+'</p>':'')+'<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="close">Закрыть</button></div></div></div>';
}

function viewTrain(){
  var e=errorsList().length, d=dueList().length;
  var h='<div class="stack" style="gap:6px;margin-bottom:20px"><p class="eyebrow">Тренировка</p><h1 class="h1">Решайте с разбором каждого ответа</h1><p class="lead">После ответа сразу видно, почему он верный, и ссылку на пункт Правил. Ошибки попадают в работу над ошибками и возвращаются, пока не закрепятся.</p></div>';
  h+='<div class="three" style="margin-bottom:26px">';
  h+='<div class="card stack" style="gap:10px"><h2 class="h3">Умная тренировка</h2><p class="small muted">20 вопросов: ваши ошибки, вопросы на повторение и слабые темы в одной сессии.</p><button class="btn primary" data-act="quiz" data-kind="smart" style="margin-top:auto">Начать</button></div>';
  h+='<div class="card stack" style="gap:10px"><h2 class="h3">Работа над ошибками</h2><p class="small muted">'+(e||d?tpl('{e} и {d} на повторение', {e:e+' '+plural(e,'ошибка','ошибки','ошибок'), d:d})+'.':'Пока пусто. Ошибки появятся здесь автоматически.')+'</p><div class="row" style="margin-top:auto"><button class="btn primary" data-act="quiz" data-kind="errors"'+(e||d?'':' disabled')+'>Прорешать</button><button class="btn ghost" data-go="errors">Список</button></div></div>';
  h+='<div class="card stack" style="gap:10px"><h2 class="h3">Знаки и сложные вопросы</h2><p class="small muted">'+tpl('Тренажер на узнавание {n} знаков и подборка ситуационных вопросов уровня 3.', {n:SIGNS.length})+'</p><div class="row" style="margin-top:auto"><button class="btn" data-act="quiz" data-kind="signs">Знаки</button><button class="btn" data-act="quiz" data-kind="hard">Сложные</button></div></div>';
  h+='</div>';
  h+='<div class="card"><div class="card-h"><h2 class="h2">По темам</h2><span class="small muted">'+tpl('{a} из {n} пройдено', {a:answeredCount(), n:CORE.length+' '+plural(CORE.length,'вопроса','вопросов','вопросов')})+'</span></div><div class="topics">';
  MODS.forEach(function(m){
    var ms=mastery(m.id);
    h+='<div class="topic" style="grid-template-columns:32px minmax(0,1fr) auto"><span class="emb">'+emblem(m.id)+'</span><span class="nm" style="white-space:normal">'+num(m)+'. '+esc(m.title)+' <span class="small muted">'+seen(m.id)+'/'+m.qs.length+' · '+pct(ms)+'%</span></span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-act="quiz" data-kind="mod" data-mod="'+m.id+'">10</button><button class="btn ghost sm" data-act="quiz" data-kind="modall" data-mod="'+m.id+'">Все</button></span></div>';
  });
  h+='</div></div>';
  return h;
}

function viewErrors(){
  var errs=errorsList(), due=dueList();
  var h='<div class="stack" style="gap:6px;margin-bottom:20px"><p class="eyebrow">Работа над ошибками</p><h1 class="h1">'+(errs.length?tpl('{n} исправления', {n:errs.length+' '+plural(errs.length,'вопрос ждет','вопроса ждут','вопросов ждут')}):'Ошибок нет')+'</h1><p class="lead">Неверный ответ попадает сюда сразу. Когда ответите верно, вопрос вернется на повторение через 1, 3, 7, 16 и 35 дней: так правило переходит в долгую память.</p></div>';
  h+='<div class="row" style="margin-bottom:22px"><button class="btn primary" data-act="quiz" data-kind="errors"'+(errs.length||due.length?'':' disabled')+'>'+tpl('Прорешать {q}', {q:qcount(Math.min(20,errs.length+due.length))})+'</button><span class="badge red">'+tpl('ошибок: {n}', {n:errs.length})+'</span><span class="badge blue">'+tpl('на повторение: {n}', {n:due.length})+'</span></div>';
  if(!errs.length){ h+='<div class="card flat"><p>Здесь появятся вопросы, на которые вы ответили неверно. Начните с <button class="btn ghost sm" data-act="quiz" data-kind="smart">умной тренировки</button>.</p></div>'; return h; }
  var by={}; errs.forEach(function(id){var m=Q[id].m; (by[m]=by[m]||[]).push(id);});
  var order = ALLMODS.map(function(m){return m.id;}).concat(['zn']);
  order.forEach(function(mid){
    if(!by[mid]) return;
    var title = mid==='zn'?'Тренажер знаков':MOD[mid].title;
    h+='<div class="card-h" style="margin-top:18px"><h2 class="h3">'+esc(title)+' <span class="badge red">'+by[mid].length+'</span></h2>'+(mid!=='zn'?'<button class="btn ghost sm" data-go="'+mid+'">Урок</button>':'')+'</div><div class="errs">';
    by[mid].slice(0,40).forEach(function(id){
      var q=Q[id];
      h+='<div class="rv">'+qMedia(q,true)+'<div class="q">'+esc(q.q)+'</div>'+qSigns(q,q.q,'sm')+'<div class="a ok">Верно: '+esc(q.options[q.answer])+'</div><div class="e">'+fmt(q.explain)+' <span class="plate">'+esc(q.ref)+'</span></div>'+rvReplay(q)+'</div>';
    });
    h+='</div>';
  });
  return h;
}

/* quiz */
function startQuiz(kind, mod, ids0){
  var ids=[], title='', from='train';
  if(kind==='lesson'||kind==='mod'){ var m=MOD[mod]; if(!m) return; ids=pickFrom(mqs(m).map(function(q){return q.id;}),10); title=m.title; if(kind==='lesson'){ if(!S.read[mod]){S.read[mod]=Date.now(); save();} from='learn'; } }
  else if(kind==='modall'){ ids=shuffle(mqs(MOD[mod]).map(function(q){return q.id;})); title='Все вопросы: '+MOD[mod].title; }
  else if(kind==='errors'){ ids=shuffle(errorsList()).slice(0,20); if(ids.length<20) ids=ids.concat(shuffle(dueList()).slice(0,20-ids.length)); title='Работа над ошибками'; }
  else if(kind==='smart'){ ids=smartPick(20); title='Умная тренировка'; }
  else if(kind==='signs'){ ids=pickFrom(SIGNS.map(function(s){return 'zn-'+s.code;}),15); title='Тренажер знаков'; }
  else if(kind==='hard'){ ids=pickFrom(CORE.filter(function(id){return Q[id].difficulty===3;}),15); title='Сложные вопросы'; }
  else if(kind==='list'){ ids=(ids0||[]).slice(); title='Ошибки экзамена'; from='exam'; }
  ids = ids.filter(function(id){return Q[id];});
  if(!ids.length){ toast('Здесь пока нет вопросов'); return; }
  QS={kind:kind, mod:mod, title:title, ids:ids, i:0, picked:{}, done:false, from:from};
  go('quiz');
}
function pri(id){var r=S.q[id]; if(!r) return 1; if(!r.ok) return 0; if(r.due<=Date.now()) return 2; return 3+r.box;}
function pickFrom(ids,n){ var s=shuffle(ids).sort(function(a,b){return pri(a)-pri(b);}).slice(0,n); return shuffle(s); }
function smartPick(n){
  var chosen=[]; function add(id){ if(chosen.indexOf(id)<0 && chosen.length<n) chosen.push(id); }
  shuffle(errorsList().filter(function(id){return eligible(Q[id]);})).slice(0,6).forEach(add);
  shuffle(dueList().filter(function(id){return eligible(Q[id]);})).slice(0,4).forEach(add);
  var order = MODS.slice().sort(function(a,b){
    var pa=(S.read[a.id]||seen(a.id))?0:1, pb=(S.read[b.id]||seen(b.id))?0:1;
    if(pa!==pb) return pa-pb; if(pa===1) return num(a)-num(b); return mastery(a.id)-mastery(b.id);
  });
  for(var i=0;i<order.length && chosen.length<n;i++){
    pickFrom(order[i].qs.map(function(q){return q.id;}),4).forEach(function(id){ var r=S.q[id]; if(!r||r.box<3) add(id); });
  }
  if(chosen.length<n) shuffle(CORE).forEach(add);
  return shuffle(chosen);
}
/* схемы ситуаций (scene.js, anim.js) лежат в отдельном файле: экран открывается сразу, схемы подгружаются, когда браузер свободен или когда они нужны */
var SCENE_URL=(window.__PDD_ASSETS||{}).scene||'', SCENE_ST=(window.PDDScene||!SCENE_URL)?2:0, SCENE_CB=[];
var SCENEVIEWS=['quiz','examrun','examres','errors'];
function sceneReady(){ return SCENE_ST>=2; }
function flushScene(){ var a=SCENE_CB; SCENE_CB=[]; a.forEach(function(f){ try{f();}catch(e){} }); }
function loadScene(cb){
  if(cb) SCENE_CB.push(cb);
  if(SCENE_ST>=2){ flushScene(); return; }
  if(SCENE_ST===1) return;
  SCENE_ST=1;
  var el=document.createElement('script'); el.src=SCENE_URL; el.async=true;
  el.onload=function(){ SCENE_ST=2; flushScene(); };
  el.onerror=function(){ SCENE_ST=3; flushScene(); };   /* не загрузилась: вопросы показываем без схем */
  document.head.appendChild(el);
}
function sceneSVG(q){ try{ return (q && q.scene && window.PDDScene) ? PDDScene.render(q.scene, SIGNSVG) : ''; }catch(e){ return ''; } }
function hasAnim(q){ return !!(q && q.scene && q.scene.anim && q.scene.anim.length && window.pddAnimate); }
function qMedia(q, small){
  var svg=sceneSVG(q);
  if(svg){
    var cap = small ? '' : ((window.PDDScene && PDDScene.caption) ? PDDScene.caption(q.scene) : '');
    return '<div class="qmedia'+(small?' sm':'')+'" data-'+(small?'rq':'q')+'="'+esc(q.id)+'">'+svg+'</div>'+(cap?'<p class="qcap">'+esc(cap)+'</p>':'');
  }
  if(q.sign && SIGN[q.sign]) return '<span class="qsign'+(small?' sm':'')+'">'+SIGN[q.sign].svg+'</span>';
  return '';
}
function rvReplay(q){ return hasAnim(q) ? '<button class="btn ghost sm" data-act="replay-rv" data-id="'+esc(q.id)+'" style="margin-top:6px">Показать проезд</button>' : ''; }
var REDUCED = false; try{ REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){}
var ANIM = null;
function playAnim(q, box){
  if(!hasAnim(q)) return;
  box = box || document.querySelector('.qmedia[data-q="'+q.id+'"]'); if(!box) return;
  if(ANIM && ANIM.stop){ try{ ANIM.stop(); }catch(e){} }
  box.innerHTML = sceneSVG(q);
  var svg = box.querySelector('svg'); if(!svg) return;
  try{ ANIM = pddAnimate(svg, q.scene.anim, {dur:1400, gap:220}); }catch(e){ ANIM = null; }
}
function viewQuiz(){
  if(!QS) return viewTrain();
  if(QS.done) return quizSummary();
  var id=QS.ids[QS.i], q=Q[id], pk=QS.picked[id], ans=pk!==undefined, n=QS.ids.length;
  var h='<div class="quiz"><div class="qhead"><div><p class="eyebrow">'+esc(QS.title)+'</p><p class="small muted">'+tpl('Вопрос {i} из {n}', {i:QS.i+1, n:n})+(q.m!=='zn'&&MOD[q.m]&&MOD[q.m].title!==QS.title?' · '+esc(MOD[q.m].title):'')+'</p></div><button class="btn ghost sm" data-act="q-drop">Закончить</button></div>';
  h+='<div class="qprog"><i style="width:'+pct((QS.i+(ans?1:0))/n)+'%"></i></div>';
  h+='<div class="qcard">'+qMedia(q)+'<p class="qtext">'+esc(q.q)+'</p>'+qSigns(q,q.q,'big')+'<div class="opts" role="group" aria-label="Варианты ответа">';
  q.options.forEach(function(o,i){
    var cls='opt'; if(ans){ if(i===q.answer) cls+=' ok'; else if(i===pk) cls+=' bad'; else cls+=' dim'; }
    h+='<button class="'+cls+'" data-act="ans" data-i="'+i+'"'+(ans?' disabled':'')+'><span class="k">'+(i+1)+'</span><span>'+esc(o)+qSigns(q,o,'opt')+'</span></button>';
  });
  h+='</div>';
  if(ans){
    var ok=pk===q.answer;
    h+='<div class="explain" aria-live="polite"><p class="vr '+(ok?'ok':'bad')+'">'+(ok?'Верно':'Неверно. Верный ответ отмечен зеленым')+'</p><p>'+fmt(q.explain)+'</p>'+qSigns(q,q.explain)+'<div class="row"><span class="plate">'+esc(q.ref)+'</span>'+(hasAnim(q)?'<button class="btn sm" data-act="replay">Показать проезд</button>':'')+(q.m!=='zn'&&MOD[q.m]?'<button class="btn ghost sm" data-go="'+q.m+'">Открыть урок</button>':'<button class="btn ghost sm" data-act="sign" data-code="'+esc(q.sign)+'">О знаке</button>')+'</div></div>';
  }
  h+='</div><div class="qfoot"><span class="kbd">Клавиши 1-4 - ответ, Enter - дальше</span>'+(ans?'<button class="btn primary" id="q-next" data-act="next">'+(QS.i<n-1?'Следующий вопрос':'Итоги')+'</button>':'')+'</div></div>';
  return h;
}
function quizSummary(){
  var ids=QS.ids.filter(function(id){return QS.picked[id]!==undefined;});
  var wrong=ids.filter(function(id){return QS.picked[id]!==Q[id].answer;});
  var c=ids.length-wrong.length;
  var h='<div class="quiz"><div class="qcard result"><p class="eyebrow">'+esc(QS.title)+'</p><div class="score" style="margin-top:10px">'+tpl('{c}<small> из {n}</small>', {c:c, n:ids.length})+'</div><p class="muted" style="margin-top:8px">'+(ids.length?tpl('{p}% верных ответов', {p:pct(c/ids.length)}):'Вы не ответили ни на один вопрос')+'</p>';
  h+='<div class="row" style="justify-content:center;margin-top:18px">'+(wrong.length?'<button class="btn primary" data-act="q-wrong">'+tpl('Прорешать {e}', {e:wrong.length+' '+plural(wrong.length,'ошибку','ошибки','ошибок')})+'</button>':'')+'<button class="btn" data-act="q-again">Еще подборка</button><button class="btn ghost" data-go="plan">К плану</button></div></div>';
  if(wrong.length){
    h+='<h2 class="h3" style="margin:24px 0 12px">Разбор ошибок</h2><div class="review">';
    wrong.forEach(function(id){var q=Q[id]; h+='<div class="rv">'+qMedia(q,true)+'<div class="q">'+esc(q.q)+'</div>'+qSigns(q,q.q,'sm')+'<div class="a bad">Ваш ответ: '+esc(q.options[QS.picked[id]])+'</div><div class="a ok">Верно: '+esc(q.options[q.answer])+'</div><div class="e">'+fmt(q.explain)+' <span class="plate">'+esc(q.ref)+'</span></div>'+rvReplay(q)+'</div>';});
    h+='</div>';
  }
  return h+'</div>';
}
function answer(i){
  if(!QS||QS.done) return; var id=QS.ids[QS.i]; if(QS.picked[id]!==undefined) return;
  if(i<0||i>=Q[id].options.length) return;
  QS.picked[id]=i; record(id, i===Q[id].answer); render(false);
  var b=document.getElementById('q-next'); if(b){ try{b.focus({preventScroll:true});}catch(e){} }
}
function nextQ(){ if(!QS) return; if(QS.i<QS.ids.length-1){ QS.i++; } else { QS.done=true; } render(); scrollTopQuiz(); }
function scrollTopQuiz(){ var el=document.querySelector('.qhead'); if(el && el.getBoundingClientRect().top<0) window.scrollTo(0,0); }

/* exam */
var EXAM_SEC = 2400;
var SPEC_N = 8;
function isSpec(q){ return G!=='B' && q.cats && q.cats.indexOf(G)>=0; }
function buildExam(){
  var spec = shuffle(CORE.filter(function(id){ return isSpec(Q[id]); })).slice(0, G==='B'?0:SPEC_N);
  var need = 40-spec.length;
  var pools = MODS.map(function(m){ return {m:m, qs:m.qs.filter(function(q){ return !isSpec(q); })}; }).filter(function(x){ return x.qs.length; });
  var total = pools.reduce(function(a,x){ return a+x.qs.length; },0);
  pools.forEach(function(x){ x.ex=need*x.qs.length/total; x.n=Math.floor(x.ex); });
  var rem = need - pools.reduce(function(a,x){return a+x.n;},0);
  pools.slice().sort(function(a,b){return (b.ex-b.n)-(a.ex-a.n);}).slice(0,rem).forEach(function(x){x.n++;});
  var ids=spec.slice(); pools.forEach(function(x){ ids=ids.concat(shuffle(x.qs).slice(0,x.n).map(function(q){return q.id;})); });
  return shuffle(ids);
}
function examCatNote(){
  var t = G==='B' ? 'Билет собирается из общих вопросов по ПДД и вопросов для легковых автомобилей (B, BE).' : tpl('В билете {n} из 40 вопросов - по особенностям вашей группы категорий ({g}), остальные - общие по ПДД.', {n:SPEC_N, g:GSHORT[G]});
  return t+' Официально база вопросов и ее состав по категориям не опубликованы: Правила приема экзаменов подтверждают один тест из 40 вопросов на все открываемые категории (п. 11, 16). Поэтому это наша модель подготовки.';
}
function examLeft(){ return S.exam ? EXAM_SEC - (Date.now()-S.exam.start)/1000 : 0; }
function startExam(){
  if(guest() && S.trialUsed && !S.exam){ go('register'); return; }
  S.exam={ids:buildExam(), ans:{}, start:Date.now(), cur:0, sel:null}; if(guest()) S.trialUsed=true;
  ASK.finish=false; flush(); go('examrun');
}
function viewExamIntro(){
  var g=guest();
  var h='<div class="stack" style="gap:6px;margin-bottom:20px"><p class="eyebrow">'+(g?'Пробный тест без регистрации':'Пробный экзамен')+'</p><h1 class="h1">Как в спецЦОН: 40 вопросов за 40 минут</h1><p class="lead">'+(G==='B'?tpl('Вопросы из всех {n} тем в той же пропорции, что и в учебнике.', {n:MODS.length}):tpl('{s} вопросов по особенностям категории {c} и {g} общих из всех тем.', {s:SPEC_N, c:esc(S.profile.cat), g:40-SPEC_N}))+' Проходной результат - минимум 32 правильных ответа, то есть не больше 8 ошибок.</p></div>';
  h+='<div class="three" style="margin-bottom:22px">';
  h+='<div class="card flat"><div class="big">40</div><p class="small muted" style="margin-top:6px">вопросов, у каждого один правильный ответ (п. 16 Правил приема экзаменов)</p></div>';
  h+='<div class="card flat"><div class="big">40:00</div><p class="small muted" style="margin-top:6px">минут на все вопросы, по истечении времени экзамен завершается (п. 17, 20)</p></div>';
  h+='<div class="card flat"><div class="big">32+</div><p class="small muted" style="margin-top:6px">правильных ответов нужно для «сдал» (п. 23)</p></div>';
  h+='</div>';
  h+='<div class="card flat" style="margin-bottom:22px"><div class="card-h"><h2 class="h3">'+tpl('Категория {c}', {c:esc(S.profile.cat)})+'</h2>'+(S.exam?'':'<button class="btn ghost sm" data-act="cat-sheet">Сменить</button>')+'</div><p class="small">'+examCatNote()+'</p></div>';
  h+='<div class="card flat" style="margin-bottom:22px"><h2 class="h3" style="margin-bottom:8px">Правила симулятора</h2><ul class="small" style="display:flex;flex-direction:column;gap:6px"><li>Отвечать можно в любом порядке, пропускать и возвращаться (п. 18).</li><li>Ответ нужно подтвердить: выберите вариант и нажмите «Подтвердить». После этого изменить его нельзя (п. 19).</li><li>Правильные ответы и результат вы увидите только в конце (п. 20).</li>'+(g?'<li>Результат и разбор ошибок покажем сразу после теста. Чтобы сохранить их и получить личный план подготовки, зарегистрируйтесь.</li>':'<li>Все ответы попадут в статистику и в работу над ошибками.</li>')+'</ul></div>';
  if(S.exam) h+='<div class="row"><button class="btn yellow" data-act="ex-resume">Продолжить начатый экзамен</button></div>';
  else if(g && S.trialUsed) h+='<div class="freebox"><b>Пробный тест без регистрации вы уже прошли</b><p>Зарегистрируйтесь, чтобы сохранить результат и получить личный план: подготовка начнется с тем, где были ошибки, а экзамены станут доступны без ограничений. Регистрация займет минуту.</p><div class="row"><button class="btn yellow" data-go="register">Зарегистрироваться</button><button class="btn" data-go="login">Войти</button></div></div>';
  else h+='<div class="row"><button class="btn primary" data-act="ex-start">'+(g?'Начать тест':'Начать экзамен')+'</button>'+(g?'<span class="small muted">Без регистрации</span>':'')+'</div>';
  if(S.exams.length){
    h+='<h2 class="h3" style="margin:26px 0 10px">История</h2><div class="review">';
    S.exams.slice().reverse().slice(0,10).forEach(function(e,i){
      h+='<div class="rv row" style="justify-content:space-between"><span>'+fdate(e.ts)+' · '+ofN(e.c, e.n)+' · '+mmss(e.dur)+'</span><span class="row" style="gap:8px">'+(e.c>=32?'<span class="badge green">сдал</span>':'<span class="badge red">не сдал</span>')+'<button class="btn ghost sm" data-act="ex-open" data-i="'+(S.exams.length-1-i)+'">Разбор</button></span></div>';
    });
    h+='</div>';
  }
  return h;
}
function viewExamRun(){
  var E=S.exam; if(!E) return viewExamIntro();
  var id=E.ids[E.cur], q=Q[id], conf=E.ans[id]!==undefined, sel=conf?E.ans[id]:E.sel;
  var done=Object.keys(E.ans).length, left=examLeft();
  var h='<div class="exam"><div>';
  h+='<div class="qhead"><div><p class="eyebrow">Пробный экзамен</p><p class="small muted">'+tpl('Вопрос {i} из {n}', {i:E.cur+1, n:40})+' · '+tpl('отвечено {d}', {d:done})+'</p></div><span class="timer'+(left<300?' low':'')+'" data-timer>'+mmss(left)+'</span></div>';
  h+='<div class="qcard">'+qMedia(q)+'<p class="qtext">'+esc(q.q)+'</p>'+qSigns(q,q.q,'big')+'<div class="opts" role="group" aria-label="Варианты ответа">';
  q.options.forEach(function(o,i){ h+='<button class="opt'+(sel===i?' sel':'')+(conf&&sel!==i?' dim':'')+'" data-act="ex-sel" data-i="'+i+'"'+(conf?' disabled':'')+'><span class="k">'+(i+1)+'</span><span>'+esc(o)+qSigns(q,o,'opt')+'</span></button>'; });
  h+='</div>';
  h+='<div class="qfoot">'+(conf?'<span class="badge blue">Ответ принят</span>':'<span class="kbd">1-4 - выбрать, Enter - подтвердить</span>')+'<span class="row" style="gap:8px">'+(conf?'':'<button class="btn" data-act="ex-skip">Пропустить</button><button class="btn primary" id="ex-ok" data-act="ex-ok"'+(sel===null||sel===undefined?' disabled':'')+'>Подтвердить</button>')+(conf?'<button class="btn primary" data-act="ex-skip">Дальше</button>':'')+'</span></div></div></div>';
  h+='<aside class="examside"><div class="card flat"><div class="grid40">';
  E.ids.forEach(function(x,i){ h+='<button class="cell'+(E.ans[x]!==undefined?' ans':'')+(i===E.cur?' cur':'')+'" data-act="ex-go" data-n="'+i+'" aria-label="'+esc(tpl('Вопрос {n}', {n:i+1}))+'">'+(i+1)+'</button>'; });
  h+='</div></div>';
  if(ASK.finish){
    var un=40-done;
    h+='<div class="confirm"><b>Завершить экзамен?</b><span class="small">'+(un?tpl('Без ответа: {n}. Они засчитаются как ошибки.', {n:qcount(un)}):'Все вопросы отвечены.')+'</span><div class="row" style="gap:8px"><button class="btn primary sm" data-act="ex-finish">Завершить</button><button class="btn sm" data-act="ex-nofinish">Вернуться</button></div></div>';
  } else h+='<button class="btn" data-act="ex-ask">Завершить экзамен</button>';
  h+='</aside></div>';
  return h;
}
function exSelect(i){ var E=S.exam; if(!E) return; var id=E.ids[E.cur]; if(E.ans[id]!==undefined) return; if(i<0||i>=Q[id].options.length) return; E.sel=i; save(); render(false); var b=document.getElementById('ex-ok'); if(b) try{b.focus({preventScroll:true});}catch(e){} }
function exConfirm(){ var E=S.exam; if(!E) return; var id=E.ids[E.cur]; if(E.sel===null||E.sel===undefined||E.ans[id]!==undefined) return; E.ans[id]=E.sel; E.sel=null; exNext(); }
function exNext(){ var E=S.exam; if(!E) return; E.sel=null; for(var k=1;k<=40;k++){ var j=(E.cur+k)%40; if(E.ans[E.ids[j]]===undefined){ E.cur=j; save(); render(); scrollTopQuiz(); return; } } ASK.finish=true; save(); render(); }
function finishExam(auto){
  var E=S.exam; if(!E) return;
  var c=0, wrong=[];
  E.ids.forEach(function(id){ var a=E.ans[id]; if(a===undefined){ wrong.push([id,-1]); } else { var ok=a===Q[id].answer; if(ok) c++; else wrong.push([id,a]); record(id,ok); } });
  var res={ts:Date.now(), n:E.ids.length, c:c, dur:Math.min(EXAM_SEC, Math.round((Date.now()-E.start)/1000)), wrong:wrong, auto:!!auto};
  S.exams.push(res); if(S.exams.length>30) S.exams=S.exams.slice(-30);
  S.exam=null; ASK.finish=false; flush();
  if(guest()) reportTrial(res);
  RES=res; go('examres');
}
function reportTrial(res){ try{ apiCall('POST','/trial',{n:res.n, c:res.c, cat:S.profile.cat, dur:res.dur}, false).catch(function(){}); }catch(e){} }
function viewExamRes(){
  var e=RES; if(!e) return viewExamIntro();
  var ok=e.c>=32, err=e.n-e.c;
  var h='<div class="quiz"><div class="qcard result"><p class="eyebrow">'+tpl('Результат пробного экзамена · {d}', {d:fdate(e.ts)})+'</p><div class="score" style="margin-top:12px">'+tpl('{c}<small> из {n}</small>', {c:e.c, n:e.n})+'</div><div class="stamp '+(ok?'ok':'bad')+'">'+(ok?'СДАЛ':'НЕ СДАЛ')+'</div>';
  h+='<p class="muted" style="margin-top:12px">'+tpl('Ошибок: {e} (допустимо 8) · время {t}', {e:err, t:mmss(e.dur)})+(e.auto?' · время вышло':'')+'</p>';
  if(guest()){
    h+='</div><div class="freebox" style="margin-top:16px"><b>'+(ok?'Отличный результат! Закрепите его':'Разберите ошибки и сдайте с первого раза')+'</b><p>'+tpl('Зарегистрируйтесь, чтобы сохранить результат и получить личный план: подготовка начнется с тем, где вы ошиблись. Откроются учебник, {n} с разбором, работа над ошибками и экзамены без ограничений.', {n:qcount(CORE_ALL.length)})+'</p><div class="row"><button class="btn yellow" data-go="register">Сохранить результат и начать</button><button class="btn" data-go="login">Войти</button></div></div>';
  } else {
    h+='<div class="row" style="justify-content:center;margin-top:18px">'+(e.wrong.length?'<button class="btn primary" data-act="ex-wrong">Прорешать ошибки</button>':'')+'<button class="btn" data-act="ex-start">Новый экзамен</button><button class="btn ghost" data-go="plan">К плану</button></div></div>';
  }
  if(e.wrong.length){
    var by={}; e.wrong.forEach(function(w){var m=Q[w[0]]&&Q[w[0]].m; if(m) by[m]=(by[m]||0)+1;});
    h+='<h2 class="h3" style="margin:24px 0 10px">Где ошибки</h2><div class="chips">';
    Object.keys(by).sort(function(a,b){return by[b]-by[a];}).forEach(function(m){ h+='<button class="chip" data-go="'+m+'">'+esc(MOD[m].title)+' · '+by[m]+'</button>'; });
    h+='</div><h2 class="h3" style="margin:24px 0 12px">Разбор</h2><div class="review">';
    e.wrong.forEach(function(w){ var q=Q[w[0]]; if(!q) return; h+='<div class="rv">'+qMedia(q,true)+'<div class="q">'+esc(q.q)+'</div>'+qSigns(q,q.q,'sm')+''+(w[1]<0?'<div class="a bad">Нет ответа</div>':'<div class="a bad">Ваш ответ: '+esc(q.options[w[1]])+'</div>')+'<div class="a ok">Верно: '+esc(q.options[q.answer])+'</div><div class="e">'+fmt(q.explain)+' <span class="plate">'+esc(q.ref)+'</span></div>'+rvReplay(q)+'</div>'; });
    h+='</div>';
  }
  return h+'</div>';
}

/* practice */
function autodromSet(){
  var c=S.profile.cat||'B', A=CATDATA.autodrom||{};
  if((c==='A1'||c==='A') && A.A && A.A.length) return {list:A.A, kind:'A'};
  if(/E$/.test(c) && A.E && A.E.length) return {list:A.E, kind:'E'};
  if(c==='Tb'||c==='Tm') return {list:[], kind:'T'};
  return {list:P.autodrom, kind:'base'};
}
function listHTML(a){ return (a&&a.length) ? '<ul class="small" style="display:flex;flex-direction:column;gap:6px">'+a.map(function(n){return '<li>'+fmt(n)+'</li>';}).join('')+'</ul>' : ''; }
function exItem(a,i){
  var op=!!OPEN[a.id], dn=!!S.adone[a.id];
  var h='<div class="ex'+(op?' open':'')+(dn?' done':'')+'"><button data-act="aopen" data-id="'+a.id+'" aria-expanded="'+op+'"><span class="no">'+(i+1)+'</span><span class="nm">'+esc(a.name)+'</span>'+CHEV+'</button>';
  if(op){
    h+='<div class="body"><p class="small muted">'+fmt(a.goal)+'</p><div><b class="small">Как выполнять</b><ol>'+(a.how||[]).map(function(x){return '<li>'+fmt(x)+'</li>';}).join('')+'</ol></div>'+((a.penalties&&a.penalties.length)?'<div><b class="small" style="color:var(--red)">За что снимают баллы</b><ul>'+a.penalties.map(function(x){return '<li>'+fmt(x)+'</li>';}).join('')+'</ul></div>':'')+(a.tip?'<div class="tip"><b>Совет</b>'+fmt(a.tip)+'</div>':'')+'<div><button class="btn sm'+(dn?'':' primary')+'" data-act="adone" data-id="'+a.id+'">'+(dn?'Снять отметку':'Отработал(а) с инструктором')+'</button></div></div>';
  }
  return h+'</div>';
}
function catPanel(cat){
  var c=CATBY[cat], p=c.practical||{}, grp=(CATDATA.groups||[]).filter(function(g){return g.id===c.group;})[0];
  var h='<div class="two"><div class="card flat stack" style="gap:14px">';
  h+='<div><p class="eyebrow">Ваша категория</p><h2 class="h2" style="margin-top:4px">'+esc(c.name)+'</h2></div>';
  [['Какие ТС',c.vehicles],['Возраст',c.age],['Стаж',c.experience],['Теория',c.theory]].forEach(function(r){ if(r[1]) h+='<div><b class="small">'+r[0]+'</b><p class="small" style="margin-top:2px">'+fmt(r[1])+'</p></div>'; });
  if(grp && grp.note) h+='<div class="tip"><b>Вопросы на сайте</b>'+fmt(grp.note)+'</div>';
  h+='</div><div class="card flat stack" style="gap:14px"><h2 class="h3">Практический экзамен</h2>';
  if(p.where) h+='<div><b class="small">Где</b><p class="small" style="margin-top:2px">'+fmt(p.where)+'</p></div>';
  if(p.vehicle) h+='<div><b class="small">На чем</b><p class="small" style="margin-top:2px">'+fmt(p.vehicle)+'</p></div>';
  if(p.exercises && p.exercises.length) h+='<div><b class="small">Упражнения</b><ol class="small olist">'+p.exercises.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol></div>';
  h+=listHTML(p.notes);
  if(autodromSet().list.length) h+='<div><button class="btn sm" data-act="ptab" data-t="autodrom">Как выполнять упражнения</button></div>';
  h+='</div></div>';
  h+='<details class="card flat" style="margin-top:16px"><summary class="h3" style="cursor:pointer">Другие категории: возраст, стаж, что дают</summary><p class="small muted" style="margin:10px 0 12px">«Выбрать» переключит учебник, тесты и экзамен на другую категорию.</p><div class="tscroll"><table class="tbl"><thead><tr><th>Категория</th><th>Что дает</th><th>Возраст</th><th>Стаж</th><th></th></tr></thead><tbody>';
  CATORDER.forEach(function(k){ if(!CATBY[k]) return; h+='<tr'+(k===cat?' class="cur"':'')+'><td><b>'+k+'</b></td><td>'+esc(CATSHORT[k])+'</td><td>'+esc(CATAGE[k]||'')+'</td><td>'+esc(CATEXP[k]||(/E$/.test(k)?'12 мес. на базовой категории':'не нужен'))+'</td><td>'+(k===cat?'<span class="badge blue">ваша</span>':'<button class="btn ghost sm" data-act="setcat" data-c="'+k+'">Выбрать</button>')+'</td></tr>'; });
  h+='</tbody></table></div><p class="small muted" style="margin-top:10px">Возраст и стаж по ст. 74 Закона РК «О дорожном движении» в действующей редакции. Удостоверение A включает A1 и B1 (с мотоциклетной посадкой), B включает A1 и B1, C включает C1, D включает D1, CE включает C1E, DE включает D1E (ст. 73 п. 8).</p></details>';
  if(CATDATA.notes && CATDATA.notes.length) h+='<details class="card flat" style="margin-top:16px"><summary class="h3" style="cursor:pointer">Как устроены экзамены по категориям</summary><div style="margin-top:12px">'+listHTML(CATDATA.notes)+'</div></details>';
  if(CATDATA.sources && CATDATA.sources.length) h+='<details class="card flat" style="margin-top:16px"><summary class="h3" style="cursor:pointer">Источники по категориям</summary><ul class="small" style="display:flex;flex-direction:column;gap:6px;margin-top:10px">'+CATDATA.sources.map(function(s){return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a></li>';}).join('')+'</ul></details>';
  return h;
}
function viewPractice(){
  var ex=P.exam, cat=S.profile.cat||'B', ci=CATBY[cat]||null, ad=autodromSet();
  var tabs=[['exam','Путь к правам'],['cat',tpl('Категория {c}', {c:cat})],['autodrom','Автодром'],['city','Город'],['check','Чек-листы']];
  if(!ci) tabs.splice(1,1);
  var pt = (PT==='cat' && !ci) ? 'exam' : PT;
  var tot=ad.list.length, done=ad.list.filter(function(a){return S.adone[a.id];}).length;
  var h='<div class="stack" style="gap:6px;margin-bottom:18px"><p class="eyebrow">Практика · '+tpl('категория {c}', {c:esc(cat)})+'</p><h1 class="h1">От медкомиссии до автодрома</h1><p class="lead">'+(tot?tpl('Как устроены экзамены в 2026 году, что требуется для категории {c}, как проходить упражнения автодрома и что нужно уметь в городе.', {c:esc(cat)}):tpl('Как устроены экзамены в 2026 году, что требуется для категории {c} и что нужно уметь в городе.', {c:esc(cat)}))+'</p></div>';
  h+='<div class="tabs" role="tablist">'+tabs.map(function(t){return '<button role="tab" data-act="ptab" data-t="'+t[0]+'" aria-selected="'+(pt===t[0])+'">'+esc(t[1])+(t[0]==='autodrom'&&tot?' <span class="badge'+(done===tot?' green':'')+'">'+done+'/'+tot+'</span>':'')+'</button>';}).join('')+'</div>';
  if(pt==='exam'){
    h+='<div class="two"><div class="card flat"><h2 class="h2" style="margin-bottom:16px">Шаги</h2><div class="steps">';
    ex.steps.forEach(function(s){ h+='<div class="step"><div><h4>'+esc(s.h.replace(/^\d+\.\s*/,''))+'</h4><p>'+fmt(s.p)+'</p></div></div>'; });
    h+='</div></div><div class="stack">';
    h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">Теория</h2><p class="small muted" style="margin-bottom:8px">'+tpl('{q} вопросов · {m} минут · минимум {p} верных · языки: {l}', {q:ex.theory.questions, m:ex.theory.minutes, p:ex.theory.passCorrect, l:esc(ex.theory.languages.join(', '))})+'</p><ul class="small" style="display:flex;flex-direction:column;gap:6px">'+ex.theory.notes.map(function(n){return '<li>'+fmt(n)+'</li>';}).join('')+'</ul><p class="small" style="margin-top:8px">'+fmt(ex.theory.validity)+'</p></div>';
    h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">Практика</h2><p class="small" style="margin-bottom:8px">'+fmt(ex.practical.where)+'</p><p class="small" style="margin-bottom:8px">'+fmt(ex.practical.scoring)+'</p><ul class="small" style="display:flex;flex-direction:column;gap:6px">'+ex.practical.notes.map(function(n){return '<li>'+fmt(n)+'</li>';}).join('')+'</ul>'+(ci&&cat!=='B'?'<p class="small" style="margin-top:10px"><button class="btn ghost sm" data-act="ptab" data-t="cat">'+tpl('Что отличается для категории {c}', {c:esc(cat)})+'</button></p>':'')+'</div>';
    h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">Пересдачи</h2><ul class="small" style="display:flex;flex-direction:column;gap:6px">'+ex.retakes.map(function(n){return '<li>'+fmt(n)+'</li>';}).join('')+'</ul></div>';
    h+='</div></div>';
    h+='<div class="card flat" style="margin-top:16px"><h2 class="h2" style="margin-bottom:12px">Изменения 2026 года</h2>';
    ex.changes2026.forEach(function(c){ var st=c.status||''; var cls=c.cls||(/^в силе/.test(st)?'green':(/^объявлено/.test(st)?'yellow':'blue')); h+='<div class="change"><div class="row" style="gap:8px;margin-bottom:4px"><b>'+esc(c.h)+'</b><span class="badge '+cls+'">'+esc(st)+'</span></div><p class="small muted" style="margin-bottom:4px">'+esc(c.date)+'</p><p class="small">'+fmt(c.p)+'</p></div>'; });
    h+='</div>';
    h+='<details class="card flat" style="margin-top:16px"><summary class="h3" style="cursor:pointer">Источники</summary><ul class="small" style="display:flex;flex-direction:column;gap:6px;margin-top:10px">'+ex.sources.map(function(s){return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a></li>';}).join('')+'</ul></details>';
  } else if(pt==='cat'){
    h+=catPanel(cat);
  } else if(pt==='autodrom'){
    var pn=(ci&&ci.practical)||{};
    if(ad.kind==='T'){
      h+='<div class="card flat stack" style="gap:10px"><h2 class="h3">'+tpl('Практику по категории {c} принимает учебная организация', {c:esc(cat)})+'</h2>'+(pn.where?'<p class="small">'+fmt(pn.where)+'</p>':'')+(pn.vehicle?'<p class="small">'+fmt(pn.vehicle)+'</p>':'')+listHTML(pn.notes)+'<p class="small muted">'+tpl('Упражнения автодрома спецЦОН для {c} не применяются. Порядок и содержание экзамена уточните в своей учебной организации.', {c:esc(cat)})+'</p></div>';
    } else {
      var intro = ad.kind==='A' ? 'Упражнения для категорий A и A1 на двухколесном мотоцикле по методике автодрома 2026 года. Правила приема экзаменов (п. 37) задают только разметку зон, поэтому уточните схему своего автодрома. Отмечайте, что уже отработали с инструктором.'
        : (ad.kind==='E' ? 'Для составов (BE, C1E, CE, D1E, DE) Правила приема экзаменов не публикуют перечень упражнений. Ниже - что известно и как готовиться; схему уточните на своем автодроме.'
        : 'Упражнения перечислены в порядке п. 38 Правил приема экзаменов. Порядок на конкретном автодроме задает его схема, а штрафы начисляет автоматическая система. Отмечайте, что уже отработали с инструктором.');
      h+='<p class="small muted" style="margin-bottom:14px">'+intro+'</p>';
      if(cat!=='B' && pn.notes && pn.notes.length) h+='<div class="card flat" style="margin-bottom:14px"><h2 class="h3" style="margin-bottom:8px">'+tpl('Для категории {c}', {c:esc(cat)})+'</h2>'+(pn.vehicle?'<p class="small" style="margin-bottom:8px"><b>На чем:</b> '+fmt(pn.vehicle)+'</p>':'')+listHTML(pn.notes)+'</div>';
      h+='<div class="stack" style="gap:10px">'+ad.list.map(exItem).join('')+'</div>';
      if(ad.kind==='E') h+='<h2 class="h3" style="margin:24px 0 8px">Упражнения базовой категории</h2><p class="small muted" style="margin-bottom:12px">Зоны первого этапа для B, C и D по п. 38 Правил приема экзаменов. Полезная тренировка перед экзаменом на состав.</p><div class="stack" style="gap:10px">'+P.autodrom.map(exItem).join('')+'</div>';
    }
  } else if(pt==='city'){
    h+='<p class="small muted" style="margin-bottom:14px">В 2026 году практический экзамен проходит на автодроме, но водить вам придется в городе. Эти навыки отрабатывайте с инструктором.</p><div class="two">';
    P.city.forEach(function(c){ h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">'+esc(c.h)+'</h2>'+(c.p||[]).map(function(p){return '<p class="small" style="margin-bottom:8px">'+fmt(p)+'</p>';}).join('')+(c.list&&c.list.length?'<ul class="small" style="display:flex;flex-direction:column;gap:5px">'+c.list.map(function(x){return '<li>'+fmt(x)+'</li>';}).join('')+'</ul>':'')+'</div>'; });
    h+='</div>';
  } else {
    var lists=[['beforeExam','Перед экзаменом'],['beforeDrive','Перед каждой поездкой']];
    h+='<div class="two">';
    lists.forEach(function(l){ h+='<div class="card flat"><div class="card-h"><h2 class="h3">'+l[1]+'</h2><button class="btn ghost sm" data-act="chk-clear" data-k="'+l[0]+'">Очистить</button></div><div class="checklist">';
      P.checklists[l[0]].forEach(function(it,i){ var k=l[0]+i; h+='<label><input type="checkbox" data-act="chk" data-k="'+k+'" id="ck-'+k+'"'+(S.chk[k]?' checked':'')+'><span>'+fmt(it)+'</span></label>'; });
      h+='</div></div>'; });
    h+='</div>';
  }
  return h;
}

function viewAbout(){
  var nsc=CORE_ALL.filter(function(id){return Q[id].scene;}).length, nspec=ALLMODS.length-20;
  var h='<div class="stack" style="gap:6px;margin-bottom:20px"><p class="eyebrow">О проекте</p><h1 class="h1">Знания о дороге должны быть доступны каждому</h1><p class="lead">Жолдас - по-казахски «попутчик». Мы собрали всё, что нужно для экзамена на права в Казахстане по всем категориям, и сделали подготовку индивидуальной: план, повторение ошибок и шкала готовности подстраиваются под каждого ученика. Обучение бесплатное и таким останется.</p></div>';
  h+='<div class="three">';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:6px">Актуально</h2><p class="small">Материал составлен по ПДД РК (Приказ МВД РК от 30.06.2023 № 534 с изменениями по 27.04.2026), Правилам приема экзаменов (ред. 2026), Закону «О дорожном движении» и КоАП РК при МРП 4 325 ₸. Каждое правило в вопросах ссылается на пункт.</p></div>';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:6px">Проверено</h2><p class="small">'+esc(D.verified||'Вопросы сверены с текущим текстом Правил отдельной проверкой: правильный ответ единственный, пункт указан верно, схема совпадает с условием.')+' Нашли неточность - сообщите, исправим.</p></div>';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:6px">Свое</h2><p class="small">'+tpl('Объяснения, {q} и {s} ситуаций написаны и нарисованы заново, простым языком. Формат экзамена повторяет спецЦОН, но это не официальная база вопросов.', {q:qcount(CORE_ALL.length), s:nsc+' '+plural(nsc,'схема','схемы','схем')})+'</p></div>';
  h+='</div>';
  h+='<div class="card flat" style="margin-top:16px"><h2 class="h3" style="margin-bottom:8px">Что внутри</h2><ul class="small" style="display:flex;flex-direction:column;gap:6px"><li>'+tpl('{n} тем учебника: 20 общих и {s} по особенностям категорий', {n:ALLMODS.length, s:nspec})+'</li><li>'+tpl('{q} с разбором, из них {s} со схемами ситуаций; во многих можно посмотреть анимацию проезда', {q:qcount(CORE_ALL.length), s:nsc})+'</li><li>'+tpl('Подготовка по 15 категориям: {c}. Учебник, тесты и экзамен подстраиваются под выбранную категорию', {c:CATORDER.join(', ')})+'</li><li>'+tpl('Каталог из {n} и тренажер на их узнавание', {n:SIGNS.length+' '+plural(SIGNS.length,'знака','знаков','знаков')})+'</li><li>Симулятор экзамена: 40 вопросов, 40 минут, подтверждение ответа</li><li>Личный план по дате экзамена, шкала готовности и интервальное повторение ошибок</li><li>Практика: упражнения автодрома для легковых, грузовых, автобусов и мотоциклов, требования по каждой категории, советы для города и чек-листы</li></ul></div>';
  if(ONLINE) h+='<div class="card flat" style="margin-top:16px"><h2 class="h3" style="margin-bottom:8px">Регистрация и данные</h2><p class="small">Для обучения нужна регистрация: так прогресс сохраняется, личный план строится по вашим ответам, а продолжить можно на любом устройстве. Мы храним имя, фамилию, дату рождения, телефон, категорию и результаты обучения на сервере в Алматы и никому их не передаем. Рекламные сообщения получают только те, кто отдельно на это согласился. Удалить аккаунт и все данные можно в профиле. <button class="btn ghost sm" data-go="privacy">Политика конфиденциальности</button></p></div>';
  h+='<div class="card flat" style="margin-top:16px"><h2 class="h3" style="margin-bottom:8px">Важно</h2><p class="small">'+tpl('Это учебный материал, а не официальное издание. Официальный текст Правил - на {a}. Суммы штрафов и порядок экзаменов могут меняться: перед экзаменом сверяйтесь с eGov и спецЦОН. Официальная база вопросов и ее состав по категориям не опубликованы, поэтому распределение вопросов по категориям - наша модель.', {a:'<a href="https://adilet.zan.kz/'+(LANG==='kk'?'kaz':'rus')+'/docs/V2300033003" target="_blank" rel="noopener">adilet.zan.kz</a>'})+' '+(ONLINE?'Прогресс хранится в вашем аккаунте на сервере в Казахстане.':'Прогресс хранится только в вашем браузере.')+'</p><p class="small muted" style="margin-top:8px">Версия материала: сентябрь 2026.'+(D.langs?' Сайт доступен на казахском, русском и английском языках.':'')+'</p></div>';
  return h;
}

/* ---------- гость, регистрация, профиль (только сборка для своего сервера) ---------- */
function pad2(n){ return (n<10?'0':'')+n; }
function isoYearsAgo(n){ var d=new Date(); return (d.getFullYear()-n)+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function ageOfISO(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m) return null; var t=new Date(); var a=t.getFullYear()-(+m[1]); if(t.getMonth()+1<+m[2] || (t.getMonth()+1===+m[2] && t.getDate()<+m[3])) a--; return a; }
function fmtPhone(p){ var d=String(p||'').replace(/\D/g,''); if(d.length!==11) return p||''; return '+'+d[0]+' '+d.slice(1,4)+' '+d.slice(4,7)+' '+d.slice(7,9)+' '+d.slice(9); }
function fmtPhoneInput(v){
  var plus=/^\s*\+/.test(v), d=String(v||'').replace(/\D/g,''), n;
  if(!d) return plus?'+7 ':'';
  if(plus || ((d[0]==='7'||d[0]==='8') && d.length===11)) n=d.slice(1); else if(d[0]==='8') n=d.slice(1); else n=d;
  if(n[0]==='8') n=n.slice(1);                  // 8 - междугородний префикс: номера в РК начинаются с 7
  if(n.length>10 && n[0]==='7') n=n.slice(1);   // лишняя 7 перед номером
  n=n.slice(0,10);
  var out='+7'; if(n.length) out+=' '+n.slice(0,3); if(n.length>3) out+=' '+n.slice(3,6); if(n.length>6) out+=' '+n.slice(6,8); if(n.length>8) out+=' '+n.slice(8,10);
  return out;
}
function catLineHTML(){ var c=S.profile.cat||'B'; return '<p class="catline">'+tpl('Категория {c}', {c:'<b>'+esc(c)+'</b>'})+' · '+esc(CATSHORT[c]||'')+' · '+qcount(CORE.length)+' <button class="linkbtn" data-act="cat-sheet">сменить</button></p>'; }
function resetRow(){ return ASK.reset?'<span class="small">Удалить весь прогресс?</span><button class="btn sm danger" data-act="reset-yes">Да, сбросить</button><button class="btn sm" data-act="reset-no">Отмена</button>':'<button class="btn ghost sm" data-act="reset">Сбросить прогресс</button>'; }
function checks(list, cls){ return '<ul class="checks'+(cls?' '+cls:'')+'">'+list.map(function(t){ return '<li>'+IC.check+'<span>'+esc(t)+'</span></li>'; }).join('')+'</ul>'; }
function courseList(){ return ['Личный план на каждый день по дате экзамена и категории', tpl('Учебник: {n} тем по ПДД РК простым языком', {n:ALLMODS.length}), tpl('{n} с разбором и схемами ситуаций', {n:qcount(CORE_ALL.length)}), 'Работа над ошибками: трудные вопросы возвращаются, пока не закрепятся', 'Шкала готовности и симулятор экзамена спецЦОН', 'Практика: автодром, город и чек-листы']; }
var GATE_TXT = {learn:'Учебник', lesson:'Урок', signs:'Каталог знаков', train:'Тренировка', quiz:'Тренировка', errors:'Работа над ошибками', practice:'Практика', profile:'Профиль'};

function viewHome(){
  var nq=CORE_ALL.length, tr=S.trialUsed, nqs=qcount(nq);
  var h='<section class="hero"><p class="eyebrow" style="color:#F5C33B">ПДД РК 2026 · все категории, от A1 до Tm</p>';
  h+='<h1>Полная подготовка к экзамену на права, <em>построенная под вас</em></h1>';
  h+='<p>'+tpl('Личный план по дате экзамена и категории, учебник по актуальным ПДД Казахстана, {n} с разбором и схемами ситуаций, работа над ошибками и симулятор экзамена спецЦОН. Всё для теории и практики в одном месте, от первого урока до сдачи.', {n:nqs})+'</p>';
  h+='<div class="facts"><span class="fact">Личный план</span><span class="fact">'+tpl('<b>{n}</b> {w} с разбором', {n:nq, w:plural(nq,'вопрос','вопроса','вопросов')})+'</span><span class="fact">Экзамен как в спецЦОН</span><span class="fact"><b>15</b> категорий</span></div>';
  h+='<div class="row"><button class="btn yellow" data-go="register">Начать подготовку</button><button class="btn" data-go="exam">'+(tr?'Мой пробный тест':'Пройти пробный тест')+'</button></div>';
  h+='<p class="small herologin">Регистрация займет минуту, обучение бесплатное. Уже учитесь? <button class="linkbtn" data-go="login">Войти</button></p></section>';
  h+='<section class="card" style="margin-top:20px"><h2 class="h2" style="margin-bottom:16px">Как устроена подготовка</h2><div class="howto">';
  [['Выберите категорию и дату экзамена','Учебник, вопросы и экзамен соберутся под вашу категорию, от мотоцикла до автобуса.'],
   ['Учитесь по личному плану','Каждый день план подсказывает, какую тему пройти и сколько вопросов решить, чтобы успеть к сроку.'],
   ['Закрывайте ошибки','Ошибки попадают в работу над ошибками, а после верного ответа возвращаются через 1, 3, 7, 16 и 35 дней, пока правило не закрепится.'],
   ['Проверьте готовность','Шкала готовности и пробные экзамены в формате спецЦОН покажут, что вы готовы к настоящему экзамену.']].forEach(function(st,i){ h+='<div class="howstep"><span class="hownum" aria-hidden="true">'+(i+1)+'</span><div><b>'+esc(st[0])+'</b><p>'+esc(st[1])+'</p></div></div>'; });
  h+='</div></section>';
  h+='<div class="card" style="margin-top:20px"><div class="two" style="align-items:center"><div><h2 class="h2" style="margin-bottom:12px">Полный курс для теории и практики</h2>'+checks(courseList())+'</div>';
  h+='<div class="startbox"><h3 class="h3">Начните с пробного теста</h3><p class="small">40 вопросов в формате спецЦОН покажут ваш уровень. После регистрации подготовка начнется с тем, где были ошибки.</p><button class="btn primary wide" data-go="exam">'+(tr?'Мой пробный тест':'Пройти пробный тест')+'</button><button class="btn wide" data-go="register">Зарегистрироваться</button><p class="tiny muted">Обучение бесплатное: без подписок и платных функций.</p></div></div></div>';
  return h;
}

function regForm(){
  var cat=S.profile.cat||'B';
  var h='<form id="reg-form" class="stack" style="gap:12px" novalidate>';
  h+='<div class="form-2"><div class="field"><label for="rg-first">Имя</label><input class="input" id="rg-first" autocomplete="given-name" maxlength="40" required></div>';
  h+='<div class="field"><label for="rg-last">Фамилия</label><input class="input" id="rg-last" autocomplete="family-name" maxlength="40" required></div></div>';
  h+='<div class="form-2"><div class="field"><label for="rg-birth">Дата рождения</label><input class="input" type="date" id="rg-birth" autocomplete="bday" min="'+isoYearsAgo(100)+'" max="'+isoYearsAgo(14)+'" required></div>';
  h+='<div class="field"><label for="rg-cat">Категория</label><select class="input" id="rg-cat">'+catOptions(cat)+'</select></div></div>';
  h+='<div class="field"><label for="rg-phone">Телефон</label><input class="input" type="tel" id="rg-phone" autocomplete="tel" inputmode="tel" placeholder="+7 7__ ___ __ __" maxlength="18" required></div>';
  h+='<div class="field"><label for="rg-pass">Пароль</label><div class="pwwrap"><input class="input" type="password" id="rg-pass" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Не короче 8 символов" required><button type="button" class="btn ghost sm" data-act="pw-toggle" data-for="rg-pass" aria-label="Показать пароль">Показать</button></div></div>';
  h+='<input class="hp" id="rg-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';
  h+='<label class="chk"><input type="checkbox" id="rg-pd" required><span>Даю согласие на сбор и обработку моих персональных данных для обучения на сайте. <button type="button" class="linkbtn2" data-act="privacy-sheet">Условия</button></span></label>';
  h+='<label class="chk" id="rg-guard-row" hidden><input type="checkbox" id="rg-guard"><span>Мне нет 18 лет. Мой родитель или законный представитель знает о регистрации и согласен на обработку моих данных</span></label>';
  h+='<label class="chk" id="rg-mk-row"><input type="checkbox" id="rg-mk"><span>Хочу получать новости, полезные материалы и предложения Жолдас по телефону, SMS и в мессенджерах. Необязательно: отказаться можно в любой момент в профиле</span></label>';
  h+='<div id="rg-msg" class="formmsg" role="alert" hidden></div>';
  h+='<button class="btn yellow wide" type="submit" id="rg-submit">Создать аккаунт</button>';
  return h+'</form>';
}
function loginForm(){
  var h='<form id="login-form" class="stack" style="gap:12px" novalidate>';
  h+='<div class="field"><label for="lg-phone">Телефон</label><input class="input" type="tel" id="lg-phone" autocomplete="tel" inputmode="tel" placeholder="+7 7__ ___ __ __" maxlength="18" required></div>';
  h+='<div class="field"><label for="lg-pass">Пароль</label><div class="pwwrap"><input class="input" type="password" id="lg-pass" autocomplete="current-password" required><button type="button" class="btn ghost sm" data-act="pw-toggle" data-for="lg-pass" aria-label="Показать пароль">Показать</button></div></div>';
  h+='<div id="lg-msg" class="formmsg" role="alert" hidden></div>';
  h+='<button class="btn primary wide" type="submit" id="lg-submit">Войти</button>';
  h+='<div><button type="button" class="linkbtn2" data-act="forgot">Забыли пароль?</button></div><div id="forgot-box" hidden></div>';
  return h+'</form>';
}
function forgotHTML(){
  var s=(CFG&&CFG.support)||{};
  return '<div class="tip"><b>Восстановление пароля</b>Напишите в поддержку'+(s.text?': '+esc(s.text):'')+'. Укажите номер, на который зарегистрирован аккаунт. Мы выдадим временный пароль, а после входа вы зададите свой.'+(s.url?' <a href="'+esc(s.url)+'" target="_blank" rel="noopener">Написать в поддержку</a>':'')+'</div>';
}
function viewAuth(mode, from){
  var reg = mode!=='login';
  var h='<div class="auth"><div class="card authcard">';
  if(from && GATE_TXT[from]) h+='<p class="gate-note">'+tpl('Чтобы открыть раздел «{s}», зарегистрируйтесь: так мы сохраним ваш прогресс и составим личный план', {s:esc(GATE_TXT[from])})+'</p>';
  if(reg){
    h+='<p class="eyebrow">Регистрация</p><h1 class="h1" style="margin:4px 0 6px">Создайте аккаунт</h1><p class="small muted" style="margin-bottom:16px">Займет минуту. По категории и дате экзамена составим личный план подготовки.</p>';
    h+=regForm()+'<p class="small" style="margin-top:14px">Уже есть аккаунт? <button class="linkbtn2" data-go="login">Войти</button></p>';
  } else {
    h+='<p class="eyebrow">Вход</p><h1 class="h1" style="margin:4px 0 16px">С возвращением</h1>';
    h+=loginForm()+'<p class="small" style="margin-top:14px">Нет аккаунта? <button class="linkbtn2" data-go="register">Зарегистрироваться</button></p>';
  }
  h+='</div><aside class="authside"><p class="eyebrow" style="color:#F5C33B">Индивидуальная подготовка</p><h2 class="h2" style="margin:6px 0 14px">Что вы получите</h2>'+checks(courseList(),'light')+'<p class="small" style="margin-top:14px;color:var(--on-asphalt-2)">Обучение бесплатное: без подписок и платных функций.</p></aside></div>';
  return h;
}
function viewMustChange(){
  return '<div class="auth single"><div class="card authcard"><p class="eyebrow">Безопасность</p><h1 class="h1" style="margin:4px 0 8px">Задайте новый пароль</h1><p class="small muted" style="margin-bottom:14px">Вы вошли по временному паролю от поддержки. Придумайте свой пароль, чтобы продолжить.</p><form id="mc-form" class="stack" style="gap:12px" novalidate><div class="field"><label for="mc-new">Новый пароль</label><input class="input" type="password" id="mc-new" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Не короче 8 символов"></div><div class="field"><label for="mc-new2">Повторите пароль</label><input class="input" type="password" id="mc-new2" autocomplete="new-password" maxlength="128"></div><div id="mc-msg" class="formmsg" role="alert" hidden></div><button class="btn primary wide" type="submit" id="mc-submit">Сохранить и продолжить</button></form></div></div>';
}
function viewProfile(){
  var u=AUTH.user, adult=ageOfISO(u.birthDate)>=18, c=S.profile.cat||'B';
  var h='<div class="stack" style="gap:6px;margin-bottom:20px"><p class="eyebrow">Профиль</p><h1 class="h1">'+esc(u.firstName+' '+u.lastName)+'</h1><p class="lead">'+tpl('Аккаунт {p}', {p:esc(fmtPhone(u.phone))})+(u.createdAt?' · '+tpl('с {d}', {d:fdate(Date.parse(u.createdAt))}):'')+'.</p></div>';
  h+='<div class="two">';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:12px">Личные данные</h2><form id="prof-form" class="stack" style="gap:12px" novalidate>';
  h+='<div class="form-2"><div class="field"><label for="pr-first">Имя</label><input class="input" id="pr-first" autocomplete="given-name" maxlength="40" value="'+esc(u.firstName)+'"></div><div class="field"><label for="pr-last">Фамилия</label><input class="input" id="pr-last" autocomplete="family-name" maxlength="40" value="'+esc(u.lastName)+'"></div></div>';
  h+='<div class="form-2"><div class="field"><label for="pr-birth">Дата рождения</label><input class="input" type="date" id="pr-birth" min="'+isoYearsAgo(100)+'" max="'+isoYearsAgo(14)+'" value="'+esc(u.birthDate||'')+'"></div><div class="field"><label for="pr-phone">Телефон</label><input class="input" id="pr-phone" value="'+esc(fmtPhone(u.phone))+'" disabled></div></div>';
  h+='<div id="pr-msg" class="formmsg" role="alert" hidden></div><div class="row"><button class="btn primary" type="submit" id="pr-submit">Сохранить</button><span class="small muted">Номер телефона меняется через поддержку</span></div></form></div>';
  h+='<div class="stack" style="gap:16px">';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">Категория</h2><p class="small" style="margin-bottom:10px"><b>'+esc(c)+'</b> · '+esc(CATSHORT[c]||'')+'. Учебник, тесты и экзамен собраны под эту категорию.</p><button class="btn sm" data-act="cat-sheet">Сменить категорию</button></div>';
  h+='<div class="card flat"><h2 class="h3" style="margin-bottom:8px">Согласия</h2><p class="small">'+tpl('Согласие на обработку персональных данных дано {d}.', {d:(u.pdConsentAt?fdate(Date.parse(u.pdConsentAt)):'при регистрации')})+' <button class="linkbtn2" data-act="privacy-sheet">Условия</button></p>';
  h+= adult ? '<label class="chk" style="margin-top:10px"><input type="checkbox" id="pr-mk" data-act="mk-toggle"'+(u.marketingConsent?' checked':'')+'><span>Получать новости, полезные материалы и предложения по телефону, SMS и в мессенджерах</span></label>' : '<p class="small muted" style="margin-top:8px">Рекламные сообщения пользователям младше 18 лет мы не отправляем.</p>';
  h+='</div></div></div>';
  h+='<div class="two" style="margin-top:16px"><div class="card flat"><h2 class="h3" style="margin-bottom:12px">Пароль</h2><form id="pw-form" class="stack" style="gap:12px" novalidate><div class="field"><label for="pw-cur">Текущий пароль</label><input class="input" type="password" id="pw-cur" autocomplete="current-password" maxlength="128"></div><div class="field"><label for="pw-new">Новый пароль</label><input class="input" type="password" id="pw-new" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Не короче 8 символов"></div><div id="pw-msg" class="formmsg" role="alert" hidden></div><div class="row"><button class="btn" type="submit" id="pw-submit">Сменить пароль</button></div></form></div>';
  h+='<div class="card flat stack" style="gap:18px"><div><h2 class="h3" style="margin-bottom:6px">Устройства</h2><p class="small muted" style="margin-bottom:8px">Вошли на чужом устройстве и забыли выйти? Завершите все сеансы.</p><div class="row"><button class="btn sm" data-act="logout">Выйти</button><button class="btn sm" data-act="logout-all">Выйти на всех устройствах</button></div></div>';
  h+='<div><h2 class="h3" style="margin-bottom:6px">Прогресс</h2><div class="row">'+resetRow()+'</div></div>';
  h+='<div><h2 class="h3" style="margin-bottom:6px">Удаление аккаунта</h2>';
  h+= ASK.del ? '<form id="del-form" class="stack" style="gap:10px" novalidate><p class="small">Аккаунт, прогресс и персональные данные будут удалены без возможности восстановления. Введите пароль для подтверждения.</p><input class="input" type="password" id="del-pw" autocomplete="current-password" placeholder="Пароль" aria-label="Пароль"><div id="del-msg" class="formmsg" role="alert" hidden></div><div class="row"><button class="btn sm danger" type="submit" id="del-submit">Удалить навсегда</button><button type="button" class="btn sm" data-act="del-no">Отмена</button></div></form>'
      : '<p class="small muted" style="margin-bottom:8px">Удалит аккаунт и все данные с сервера.</p><button class="btn sm danger" data-act="del-ask">Удалить аккаунт</button>';
  h+='</div></div></div>';
  return h;
}
function privacyHTML(){
  var op=(CFG&&CFG.operator)||{}, sp=(CFG&&CFG.support)||{};
  var who = op.name ? esc(op.name)+(op.id?', ИИН/БИН '+esc(op.id):'')+(op.address?', адрес: '+esc(op.address):'') : 'владелец сайта «Жолдас»';
  var contact = op.contact || sp.text || '';
  function sec(t, body){ return '<section><h2 class="h3">'+t+'</h2>'+body+'</section>'; }
  function ul(a){ return '<ul>'+a.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul>'; }
  var h='<div class="policy"><p class="eyebrow">Редакция от 23.09.2026</p><h1 class="h1" style="margin:6px 0 16px">Политика конфиденциальности и согласие на обработку персональных данных</h1>';
  h+=sec('Кто обрабатывает данные','<p>Собственник и оператор персональных данных: '+who+'.'+(contact?' Контакт для обращений: '+esc(contact)+'.':'')+'</p>');
  h+=sec('Какие данные мы храним', ul(['имя и фамилия','дата рождения','номер телефона','категория обучения','результаты обучения: ответы на вопросы, пробные экзамены, прочитанные темы, дата экзамена и цель на день','пароль, только в виде необратимого хэша: сам пароль мы не видим и не храним','дата и время регистрации, IP-адрес и тип браузера в момент регистрации: они подтверждают, что согласие дали вы']));
  h+=sec('Зачем', ul(['создать и вести личный кабинет, сохранять прогресс и открывать его на любом устройстве','помогать с доступом к аккаунту, например выдать временный пароль','считать обезличенную статистику, чтобы улучшать вопросы и объяснения','отправлять новости, полезные материалы и предложения, в том числе партнеров, по телефону, SMS и в мессенджерах, только если вы дали на это отдельное согласие']));
  h+=sec('Где и сколько хранятся','<p>Данные хранятся на сервере в Республике Казахстан (г. Алматы), трансграничная передача не производится. Мы храним данные, пока у вас есть аккаунт. После удаления аккаунта данные удаляются сразу, из резервных копий - в течение 14 дней.</p>');
  h+=sec('Кому передаются','<p>Мы не продаем, не передаем третьим лицам и не публикуем ваши персональные данные. Сервер размещен у хостинг-провайдера в Алматы, который обеспечивает работу оборудования. Государственным органам данные предоставляются только в случаях, предусмотренных законодательством Республики Казахстан.</p>');
  h+=sec('Рекламные сообщения','<p>Согласие на рекламные сообщения отдельное и необязательное: без него доступны все функции сайта. Отозвать его можно в любой момент в профиле, после этого сообщения больше не отправляются. Пользователям младше 18 лет рекламные сообщения не отправляются.</p>');
  h+=sec('Если вам меньше 18 лет','<p>Регистрация с 14 до 18 лет возможна только с согласия родителя или законного представителя.</p>');
  h+=sec('Ваши права','<p>Вы можете узнать, какие данные о вас хранятся, исправить их в профиле, отозвать согласие и удалить аккаунт со всеми данными в разделе «Профиль». '+(contact?tpl('По другим вопросам пишите по контакту: {c}.', {c:esc(contact)}):'По другим вопросам пишите в поддержку.')+'</p>');
  h+=sec('Согласие','<p>Отмечая галочку при регистрации, вы даете собственнику и оператору, указанному выше, согласие на сбор и обработку перечисленных данных для указанных целей на срок существования аккаунта в соответствии с Законом Республики Казахстан «О персональных данных и их защите». Данные не передаются третьим лицам, за границу и не размещаются в общедоступных источниках. Отозвать согласие можно, удалив аккаунт.</p>');
  return h+'</div>';
}
function viewPrivacy(){ if(!CFG) loadConfig().then(function(){ if(R.v==='privacy') render(false); }); return privacyHTML(); }

/* ---------- всплывающие окна: знак, меню аккаунта, категории, условия ---------- */
function sheetHTML(){
  if(SHEET==='acct' && AUTH){
    var u=AUTH.user, c=S.profile.cat||'B';
    return '<div class="overlay top" data-act="sheet-close"><div class="menu" role="dialog" aria-modal="true" aria-label="Мой аккаунт"><div class="menu-h"><span class="ava lg" aria-hidden="true">'+esc(initials(u))+'</span><div><b>'+esc(u.firstName+' '+u.lastName)+'</b><span class="small muted">'+esc(fmtPhone(u.phone))+'</span></div></div>'
      +'<button class="menu-i" data-act="cat-sheet"><span>'+tpl('Категория {c}', {c:'<b>'+esc(c)+'</b>'})+'<small>'+esc(CATSHORT[c]||'')+'</small></span><span class="small" style="color:var(--blue)">Сменить</span></button>'
      +'<button class="menu-i" data-go="profile">Мой профиль</button><button class="menu-i" data-go="plan">Мой план</button><button class="menu-i" data-go="about">О проекте</button><button class="menu-i danger" data-act="logout">Выйти</button></div></div>';
  }
  if(SHEET==='cat'){
    var cur=S.profile.cat||'B';
    return '<div class="overlay" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Категория обучения"><h2 class="h2" style="margin-bottom:6px">Категория обучения</h2><p class="small muted" style="margin-bottom:14px">Учебник, тесты и экзамен подстроятся под выбранную категорию.</p><div class="catlist">'
      +CATORDER.filter(function(k){ return CATBY[k] || k==='B'; }).map(function(k){ return '<button class="cati'+(k===cur?' cur':'')+'" data-act="setcat" data-c="'+k+'"'+(k===cur?' aria-current="true"':'')+'><b>'+k+'</b><span>'+esc(CATSHORT[k])+'</span>'+(k===cur?'<span class="badge blue">сейчас</span>':'')+'</button>'; }).join('')
      +'</div><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" data-act="sheet-close">Закрыть</button></div></div></div>';
  }
  if(SHEET==='privacy'){
    return '<div class="overlay" data-act="sheet-close"><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Условия обработки данных">'+privacyHTML()+'<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn primary" data-act="sheet-close">Понятно</button></div></div></div>';
  }
  return '';
}
function renderOverlay(){
  var o=document.getElementById('ovl');
  if(!o){ o=document.createElement('div'); o.id='ovl'; document.body.appendChild(o); }
  o.innerHTML = overlayHTML() || sheetHTML();
  document.body.classList.toggle('noscroll', !!(OVER || SHEET));
}

/* ---------- render ---------- */
/* Главный экран гостя уже лежит в HTML (tools/prerender.py). Если приложение собирает ровно тот же экран, оставляем готовые элементы на месте:
   браузер не считает их новыми (быстрее показ, нет мигания), а блок для поисковиков ниже убираем. Иначе экран заменяется как обычно. */
var FIRST_PRE = true;
function adoptPre(app, full){
  try{
    var a=app.firstChild; if(!a || a.nodeType!==8 || a.nodeValue!=='pre:app') return false;
    var st=[], n=a.nextSibling;
    while(n && !(n.nodeType===8 && n.nodeValue==='/pre:app')){ st.push(n); n=n.nextSibling; }
    if(!n || !st.length) return false;
    var t=document.createElement('div'); t.innerHTML=full;
    if(t.childNodes.length!==st.length) return false;
    for(var i=0;i<st.length;i++){ if(!st[i].isEqualNode(t.childNodes[i])) return false; }
    while(n.nextSibling) app.removeChild(n.nextSibling);
    app.removeChild(n); app.removeChild(a);
    return true;
  }catch(e){ return false; }
}
function render(keepScroll){
  try{ document.documentElement.classList.remove('ret'); }catch(e){}   // заготовка первого экрана из HTML больше не нужна
  navHTML();
  var app=document.getElementById('app');
  var v=R.v, html='';
  if(!sceneReady() && SCENEVIEWS.indexOf(v)>=0){ app.innerHTML='<div class="wait" role="status" aria-busy="true"></div>'; loadScene(function(){ render(false); }); return; }
  if(AUTH && (v==='register'||v==='login')){ R={v:'plan',p:null}; v='plan'; try{ history.replaceState(null,'','#plan'); }catch(e){} }
  if(v!=='quiz'&&v!=='examrun'&&v!=='examres') prevV={v:v,p:R.p};
  if(AUTH && AUTH.user.mustChangePassword) html=viewMustChange();
  else if(guest() && OPEN_VIEWS.indexOf(v)<0) html=viewAuth('register', v);
  else if(v==='plan') html=guest()?viewHome():viewPlan();
  else if(v==='register'||v==='login') html=ONLINE?viewAuth(v):viewPlan();
  else if(v==='profile') html=AUTH?viewProfile():viewPlan();
  else if(v==='privacy') html=ONLINE?viewPrivacy():viewAbout();
  else if(v==='learn') html=viewLearn();
  else if(v==='lesson') html=viewLesson(R.p);
  else if(v==='signs') html=viewSigns();
  else if(v==='train') html=viewTrain();
  else if(v==='errors') html=viewErrors();
  else if(v==='quiz') html=viewQuiz();
  else if(v==='exam') html=viewExamIntro();
  else if(v==='examrun') html=viewExamRun();
  else if(v==='examres') html=viewExamRes();
  else if(v==='practice') html=viewPractice();
  else if(v==='about') html=viewAbout();
  else html=viewPlan();
  var full = liveHTML() + html, adopt = FIRST_PRE; FIRST_PRE = false;
  if(!(adopt && adoptPre(app, full))) app.innerHTML = full;
  renderOverlay();
  if(v==='quiz' && QS && !QS.done){
    QS.anim = QS.anim || {}; var cid = QS.ids[QS.i], cq = Q[cid];
    if(QS.picked[cid]!==undefined && hasAnim(cq) && !QS.anim[cid] && !REDUCED){
      QS.anim[cid] = 1;
      setTimeout(function(){ if(R.v==='quiz' && QS && !QS.done && QS.ids[QS.i]===cid) playAnim(cq); }, 380);
    }
  }
}

/* ---------- toast ---------- */
var toastT=null;
function toast(msg){ var t=document.getElementById('toast'); if(!t){t=document.createElement('div'); t.id='toast'; t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t);} t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){t.hidden=true;},2600); }

/* ---------- events ---------- */
document.addEventListener('click', function(e){
  var g=e.target.closest('[data-go]');
  if(g){ e.preventDefault(); OVER=null; SHEET=null; go(g.getAttribute('data-go')); return; }
  var a=e.target.closest('[data-act]'); if(!a) return;
  var act=a.getAttribute('data-act');
  if(act==='close'){ if(e.target.closest('.sheet') && !e.target.closest('button[data-act="close"]')) return; OVER=null; renderOverlay(); return; }
  if(act==='sheet-close'){ if(e.target.closest('.sheet,.menu') && !e.target.closest('button[data-act="sheet-close"]')) return; SHEET=null; renderOverlay(); navHTML(); return; }
  switch(act){
    case 'quiz': startQuiz(a.getAttribute('data-kind'), a.getAttribute('data-mod')); break;
    case 'ans': answer(+a.getAttribute('data-i')); break;
    case 'next': nextQ(); break;
    case 'acct': SHEET = SHEET==='acct' ? null : 'acct'; renderOverlay(); navHTML(); break;
    case 'lang': setLang(a.getAttribute('data-code')); break;
    case 'cat-sheet': SHEET='cat'; renderOverlay(); var cc=document.querySelector('.cati.cur'); if(cc) try{ cc.focus({preventScroll:true}); }catch(x){} break;
    case 'privacy-sheet': SHEET='privacy'; renderOverlay(); if(!CFG) loadConfig().then(function(){ if(SHEET==='privacy') renderOverlay(); }); break;
    case 'logout': doLogout(); break;
    case 'logout-all': doLogoutAll(); break;
    case 'pw-toggle': var pi=document.getElementById(a.getAttribute('data-for')); if(pi){ var show=pi.type==='password'; pi.type=show?'text':'password'; a.textContent=show?'Скрыть':'Показать'; a.setAttribute('aria-label', show?'Скрыть пароль':'Показать пароль'); } break;
    case 'forgot': var fb=document.getElementById('forgot-box'); if(fb){ fb.hidden=false; fb.innerHTML=forgotHTML(); loadConfig().then(function(){ var f2=document.getElementById('forgot-box'); if(f2) f2.innerHTML=forgotHTML(); }); } break;
    case 'del-ask': ASK.del=true; render(false); var dp=document.getElementById('del-pw'); if(dp) try{ dp.focus({preventScroll:true}); }catch(x){} break;
    case 'del-no': ASK.del=false; render(false); break;
    case 'mk-toggle': setMarketing(a); return;
    case 'replay': if(QS){ var rq=Q[QS.ids[QS.i]]; if(rq) playAnim(rq); } break;
    case 'replay-rv': var rid=a.getAttribute('data-id'), rq2=Q[rid], rbox=document.querySelector('.qmedia[data-rq="'+rid+'"]'); if(rq2 && rbox) playAnim(rq2, rbox); break;
    case 'setcat': setCat(a.getAttribute('data-c')); break;
    case 'q-drop': if(QS){ QS.done=true; } go('quiz'); break;
    case 'q-resume': go('quiz'); break;
    case 'q-wrong': var w=QS.ids.filter(function(id){return QS.picked[id]!==undefined && QS.picked[id]!==Q[id].answer;}); QS={kind:'list2', title:'Повтор ошибок', ids:shuffle(w), i:0, picked:{}, done:false, from:QS.from}; go('quiz'); break;
    case 'q-again': var k=QS.kind; if(k==='list'||k==='list2') k='errors'; startQuiz(k, QS.mod); break;
    case 'read': S.read[a.getAttribute('data-mod')]=Date.now(); save(); render(false); toast('Тема отмечена как прочитанная'); break;
    case 'sign': OVER=a.getAttribute('data-code'); renderOverlay(); var c=document.querySelector('.sheet button[data-act="close"]'); if(c) try{c.focus({preventScroll:true});}catch(x){} break;
    case 'sgroup': SG.g=a.getAttribute('data-g'); render(false); break;
    case 'ex-start': startExam(); break;
    case 'ex-resume': go('examrun'); break;
    case 'ex-sel': exSelect(+a.getAttribute('data-i')); break;
    case 'ex-ok': exConfirm(); break;
    case 'ex-skip': exNext(); break;
    case 'ex-go': if(S.exam){ S.exam.cur=+a.getAttribute('data-n'); S.exam.sel=null; save(); render(false);} break;
    case 'ex-ask': ASK.finish=true; render(false); break;
    case 'ex-nofinish': ASK.finish=false; render(false); break;
    case 'ex-finish': finishExam(false); break;
    case 'ex-wrong': if(RES) startQuiz('list', null, RES.wrong.map(function(x){return x[0];})); break;
    case 'ex-open': RES=S.exams[+a.getAttribute('data-i')]; go('examres'); break;
    case 'ptab': PT=a.getAttribute('data-t'); render(false); break;
    case 'aopen': var id=a.getAttribute('data-id'); OPEN[id]=!OPEN[id]; render(false); break;
    case 'adone': var id2=a.getAttribute('data-id'); if(S.adone[id2]) delete S.adone[id2]; else S.adone[id2]=Date.now(); save(); render(false); break;
    case 'chk': var ck=a.getAttribute('data-k'); if(a.checked) S.chk[ck]=1; else delete S.chk[ck]; save(); return;
    case 'chk-clear': var pre=a.getAttribute('data-k'); Object.keys(S.chk).forEach(function(x){ if(x.indexOf(pre)===0) delete S.chk[x]; }); save(); render(false); break;
    case 'edit-profile': ASK.profile=true; if(R.v!=='plan'){ go('plan'); } else { render(false); } var pf=document.getElementById('pf'); if(pf){ try{ pf.scrollIntoView({block:'center'}); }catch(x){} var pn=document.getElementById('pf-date'); if(pn) try{ pn.focus({preventScroll:true}); }catch(x){} } break;
    case 'pf-daily': S.profile.daily=+a.getAttribute('data-n'); S.profile.mt=Date.now(); save(); a.parentNode.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed', String(b===a));}); break;
    case 'export': var ta=document.getElementById('xfer'); ta.value=exportCode(); ta.select(); break;
    case 'copy': var t2=document.getElementById('xfer'); if(!t2.value) t2.value=exportCode(); t2.select(); try{ navigator.clipboard.writeText(t2.value).then(function(){toast('Код скопирован');},function(){toast('Выделите код и скопируйте вручную');}); }catch(x){ toast('Выделите код и скопируйте вручную'); } break;
    case 'import': importCode(document.getElementById('xfer').value); break;
    case 'reset': ASK.reset=true; render(false); break;
    case 'reset-no': ASK.reset=false; render(false); break;
    case 'reset-yes': var keep={owner:S.owner, trialUsed:S.trialUsed, cat:S.profile.cat, examDate:S.profile.examDate, daily:S.profile.daily}; S=fresh(); S.owner=keep.owner; S.trialUsed=keep.trialUsed; S.resetAt=Date.now(); S.profile.cat=keep.cat||'B'; S.profile.examDate=keep.examDate||''; S.profile.daily=keep.daily||30; S.profile.mt=S.resetAt; setGroup(); QS=null; RES=null; ASK.reset=false; flush(); syncSoon(300); render(false); toast('Прогресс сброшен'); break;
  }
});
document.addEventListener('submit', function(e){
  var id=e.target.id;
  if(['reg-form','login-form','mc-form','prof-form','pw-form','del-form'].indexOf(id)>=0){ e.preventDefault(); FORMS[id](); return; }
  if(id!=='pf') return; e.preventDefault();
  var pn=document.getElementById('pf-name'); if(pn) S.profile.name=(pn.value||'').trim().slice(0,30);
  S.profile.examDate=document.getElementById('pf-date').value||'';
  S.profile.mt=Date.now(); ASK.profile=false; flush(); syncSoon(); render(false); toast('План сохранен');
});
document.addEventListener('toggle', function(e){ if(e.target && e.target.id==='xfer-box') ASK.xferOpen=e.target.open; }, true);
document.addEventListener('change', function(e){
  if(e.target.id==='rg-birth') updateRegAge();
});
document.addEventListener('input', function(e){
  var id=e.target.id;
  if(id==='sg-q'){ SG.q=e.target.value; var g=document.getElementById('sg-grid'); if(g) g.innerHTML=signsGrid(); }
  else if(id==='rg-phone'||id==='lg-phone'){ var v=fmtPhoneInput(e.target.value); if(v!==e.target.value) e.target.value=v; }
  else if(id==='rg-birth') updateRegAge();
});
document.addEventListener('focusin', function(e){
  var id=e.target && e.target.id;
  if((id==='rg-phone'||id==='lg-phone') && !e.target.value) e.target.value='+7 ';
});
document.addEventListener('keydown', function(e){
  if(e.target.closest && e.target.closest('input,textarea,select')) return;
  if(e.key==='Escape' && (OVER||SHEET)){ OVER=null; SHEET=null; renderOverlay(); navHTML(); return; }
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  var n=KEYS.indexOf(e.key);
  if(R.v==='quiz' && QS && !QS.done){
    if(n>=0){ e.preventDefault(); answer(n); }
    else if(e.key==='Enter' && e.target.tagName!=='BUTTON' && QS.picked[QS.ids[QS.i]]!==undefined){ e.preventDefault(); nextQ(); }
  } else if(R.v==='examrun' && S.exam){
    if(n>=0){ e.preventDefault(); exSelect(n); }
    else if(e.key==='Enter' && e.target.tagName!=='BUTTON'){ e.preventDefault(); exConfirm(); }
  }
});

function exportCode(){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }catch(e){ return ''; } }
function importCode(code){
  code=(code||'').trim(); if(!code){ toast('Вставьте код в поле'); return; }
  try{
    var o=JSON.parse(decodeURIComponent(escape(atob(code))));
    if(!o || typeof o!=='object' || !o.q || !o.profile) throw new Error('bad');
    var f=fresh(); Object.keys(f).forEach(function(k){ if(o[k]===undefined) o[k]=f[k]; });
    S=o; if(!S.profile.cat) S.profile.cat='B'; setGroup(); sanitizeExam(); flush(); syncSoon(); render(false); toast('Прогресс загружен');
  }catch(e){ toast('Код не распознан. Скопируйте его целиком и попробуйте снова'); }
}


/* ---------- аккаунт и синхронизация прогресса (только сборка для своего сервера: D.api) ---------- */
var SY = { busy: false, t: null, last: 0, err: '', again: false, fails: 0 };
function syncAvailable(){ return ONLINE && !!AUTH; }
function syncPayload(){ var o=JSON.parse(JSON.stringify(S)); delete o.exam; delete o.noSync; delete o.owner; delete o.trialUsed; if(o.profile) delete o.profile.name; return o; }
function syncMerge(a, b){
  a=a||{}; b=b||{};
  var resetAt=Math.max(a.resetAt||0, b.resetAt||0);
  function keep(t){ return !resetAt || (t||0)>=resetAt; }
  function each(o, f){ o=o||{}; Object.keys(o).forEach(function(k){ f(k, o[k]); }); }
  var o={v:1, resetAt:resetAt};
  var pa=a.profile||{}, pb=b.profile||{};
  o.profile=Object.assign({}, (pb.mt||0)>=(pa.mt||0) ? pb : pa);
  o.q={}; [a.q, b.q].forEach(function(src){ each(src, function(id, r){ if(!r || !keep(r.t)) return; var c=o.q[id]; if(!c || (r.t||0)>(c.t||0)) o.q[id]=r; }); });
  o.read={}; [a.read, b.read].forEach(function(src){ each(src, function(k, t){ if(keep(t)) o.read[k]=Math.max(o.read[k]||0, t); }); });
  o.days={}; [a.days, b.days].forEach(function(src){ each(src, function(k, d){ if(!d || (resetAt && Date.parse(k+'T23:59:59Z')<resetAt)) return; var c=o.days[k]; o.days[k]= c ? {n:Math.max(c.n,d.n), c:Math.max(c.c,d.c)} : {n:d.n, c:d.c}; }); });
  var ex={}; (a.exams||[]).concat(b.exams||[]).forEach(function(e){ if(e && keep(e.ts)) ex[e.ts]=e; });
  o.exams=Object.keys(ex).map(function(k){ return ex[k]; }).sort(function(x,y){ return x.ts-y.ts; }).slice(-30);
  o.adone={}; [a.adone, b.adone].forEach(function(src){ each(src, function(k, t){ if(keep(t)) o.adone[k]=Math.max(o.adone[k]||0, t); }); });
  o.chk=Object.assign({}, (b.resetAt||0)>(a.resetAt||0) ? {} : (a.chk||{}), b.chk||{});
  return o;
}
function sig(o){ return Object.keys(o.q||{}).length+':'+(o.exams||[]).length+':'+Object.keys(o.read||{}).length+':'+(o.profile&&o.profile.cat)+':'+(o.resetAt||0); }
function applyRemote(remote){
  if(!remote) return false;
  var local=syncPayload(), before=sig(local)+JSON.stringify(local.profile);
  var m=syncMerge(remote, local);
  var name=S.profile.name, exam=S.exam;
  var f=fresh(); Object.keys(m).forEach(function(k){ S[k]=m[k]; });
  Object.keys(f).forEach(function(k){ if(S[k]===undefined) S[k]=f[k]; });
  S.profile=Object.assign(f.profile, S.profile); S.profile.name=name; S.exam=exam;
  setGroup(); flush();
  return before !== sig(S)+JSON.stringify(syncPayload().profile);
}
function apiCall(method, path, body, token, keepalive){
  var h={'Content-Type':'application/json', 'X-Lang':LANG}; var tk= token===false ? null : (token||(AUTH&&AUTH.token)); if(tk) h.Authorization='Bearer '+tk;
  var opt={method:method, headers:h, body: body?JSON.stringify(body):undefined, cache:'no-store'}; if(keepalive) opt.keepalive=true;   // keepalive: запрос переживет переход на другую страницу
  return fetch(D.api+path, opt).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok){ var e=new Error(j.error||tpl('Ошибка {s}', {s:r.status})); e.status=r.status; e.code=j.code||''; throw e; } return j; });
  }, function(){ var e=new Error('Нет связи с сервером. Проверьте интернет и попробуйте еще раз'); e.status=0; throw e; });
}
function hasProgress(){ return Object.keys(S.q).length>0 || S.exams.length>0; }
function syncSoon(ms){ if(!syncAvailable()) return; clearTimeout(SY.t); SY.t=setTimeout(syncNow, ms==null?4000:ms); }
function syncNow(){
  if(!syncAvailable()) return Promise.resolve();
  if(SY.busy){ SY.again=true; return Promise.resolve(); }
  clearTimeout(SY.t); SY.busy=true; SY.again=false; syncUI('Сохраняю...');
  return apiCall('PUT','/state',{state:syncPayload()}).then(function(r){
    SY.busy=false; SY.last=Date.now(); SY.err=''; SY.fails=0;
    var changed=applyRemote(r.state);
    if(changed && ['plan','learn','train','errors','exam','lesson','profile'].indexOf(R.v)>=0 && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(false);
    syncUI();
    if(SY.again) syncSoon(1500);
  }).catch(function(e){
    SY.busy=false;
    if(e.status===401 || e.code==='blocked'){ sessionEnded(e.code==='blocked'?'Аккаунт заблокирован. Обратитесь в поддержку':'Сессия завершена, войдите снова'); return; }
    if(e.code==='must_change'){ AUTH.user.mustChangePassword=true; saveAuth(AUTH); render(); return; }
    SY.fails++; SY.err='Нет связи с сервером, сохраним позже'; syncSoon(Math.min(300000, 15000*SY.fails)); syncUI();
  });
}
function syncStatus(){
  if(SY.busy) return 'Сохраняю...';
  if(SY.err) return SY.err;
  if(SY.last) return tpl('Сохранено в {t}.', {t:pad(new Date(SY.last).getHours())+':'+pad(new Date(SY.last).getMinutes())});
  return '';
}
function syncUI(text){ var el=document.getElementById('sync-st'); if(el) el.textContent=text||syncStatus(); }
function loadConfig(){
  if(CFG) return Promise.resolve(CFG);
  if(!ONLINE) return Promise.resolve({});
  return apiCall('GET','/config',null,false).then(function(c){ CFG=c; return c; }).catch(function(){ return {}; });
}
function signOutLocal(){
  clearTimeout(SY.t); saveAuth(null);
  var tu=S.trialUsed; S=fresh(); S.trialUsed=!!tu; setGroup(); QS=null; RES=null; ASK.del=false; ASK.reset=false; SHEET=null; flush();
}
function sessionEnded(msg){ signOutLocal(); go('login'); toast(msg); }
function onAuthed(r, isNew){
  var local = (!isNew && !S.owner && hasProgress()) ? syncPayload() : null;   // прогресс гостя (пробный тест) переносим в аккаунт
  var ex=S.exam, tu=S.trialUsed;
  saveAuth({token:r.token, user:r.user});
  S=fresh(); S.trialUsed=!!tu; S.exam=ex; S.owner=r.user.id;
  if(r.state) applyRemote(r.state);
  if(local){ local.profile={mt:0}; applyRemote(local); syncSoon(500); }
  if(!r.state){ S.profile.cat=r.user.category||'B'; setGroup(); }
  flush();
}
function formMsg(id, text, err){ var el=document.getElementById(id); if(!el) return; el.hidden=!text; el.textContent=text||''; el.className='formmsg'+(err?' err':' ok'); }
function setBtn(id, busy, text){ var b=document.getElementById(id); if(b){ b.disabled=!!busy; if(text) b.textContent=text; } }
function val(id){ var el=document.getElementById(id); return el ? String(el.value||'').trim() : ''; }
function ck(id){ var el=document.getElementById(id); return !!(el && el.checked && !(el.closest('[hidden]'))); }
function updateRegAge(){
  var a=ageOfISO(val('rg-birth')), minor = a!==null && a<18;
  var g=document.getElementById('rg-guard-row'), m=document.getElementById('rg-mk-row');
  if(g) g.hidden=!minor;
  if(m){ m.hidden=minor; if(minor){ var mk=document.getElementById('rg-mk'); if(mk) mk.checked=false; } }
}
function afterAuthNav(){ if(R.v==='register'||R.v==='login'||R.v==='plan') go('plan'); else { render(); window.scrollTo(0,0); } }
var FORMS = {
  'reg-form': function(){
    if(BUSY) return;
    var b={firstName:val('rg-first'), lastName:val('rg-last'), birthDate:val('rg-birth'), category:val('rg-cat'), phone:val('rg-phone'), password:(document.getElementById('rg-pass')||{}).value||'',
      pdConsent:ck('rg-pd'), guardianConsent:ck('rg-guard'), marketingConsent:ck('rg-mk'), website:val('rg-hp'), trial:!!S.trialUsed, lang:LANG};
    var age=ageOfISO(b.birthDate);
    var err = !b.firstName?'Укажите имя' : !b.lastName?'Укажите фамилию' : !b.birthDate?'Укажите дату рождения' : (age!==null&&age<14)?'Регистрация доступна с 14 лет'
      : b.phone.replace(/\D/g,'').length<11?'Укажите номер телефона полностью' : b.password.length<8?'Пароль не короче 8 символов'
      : !b.pdConsent?'Отметьте согласие на обработку персональных данных' : (age!==null&&age<18&&!b.guardianConsent)?'Нужно согласие родителя или законного представителя' : '';
    if(err){ formMsg('rg-msg', err, true); return; }
    b.state = hasProgress() ? syncPayload() : null;
    BUSY=true; formMsg('rg-msg',''); setBtn('rg-submit', true, 'Регистрируем...');
    apiCall('POST','/auth/register', b, false).then(function(r){
      BUSY=false; onAuthed(r, true); afterAuthNav(); toast(tpl('Добро пожаловать, {name}! Ваш план подготовки готов', {name:r.user.firstName}));
    }).catch(function(e){ BUSY=false; setBtn('rg-submit', false, 'Создать аккаунт'); formMsg('rg-msg', e.message||'Не удалось зарегистрироваться', true); });
  },
  'login-form': function(){
    if(BUSY) return;
    var ph=val('lg-phone'), pw=(document.getElementById('lg-pass')||{}).value||'';
    if(ph.replace(/\D/g,'').length<11){ formMsg('lg-msg','Укажите номер телефона полностью', true); return; }
    if(!pw){ formMsg('lg-msg','Введите пароль', true); return; }
    BUSY=true; formMsg('lg-msg',''); setBtn('lg-submit', true, 'Входим...');
    apiCall('POST','/auth/login', {phone:ph, password:pw}, false).then(function(r){
      BUSY=false; onAuthed(r, false); afterAuthNav(); toast(tpl('Сәлем, {name}!', {name:r.user.firstName}));
    }).catch(function(e){ BUSY=false; setBtn('lg-submit', false, 'Войти'); formMsg('lg-msg', e.message||'Не удалось войти', true); });
  },
  'mc-form': function(){
    var a=(document.getElementById('mc-new')||{}).value||'', b2=(document.getElementById('mc-new2')||{}).value||'';
    if(a.length<8){ formMsg('mc-msg','Пароль не короче 8 символов', true); return; }
    if(a!==b2){ formMsg('mc-msg','Пароли не совпадают', true); return; }
    setBtn('mc-submit', true);
    apiCall('POST','/me/password', {next:a}).then(function(r){ AUTH.user=r.user; saveAuth(AUTH); render(); toast('Пароль сохранен'); refreshMe(); })
      .catch(function(e){ setBtn('mc-submit', false); formMsg('mc-msg', e.message, true); });
  },
  'prof-form': function(){
    setBtn('pr-submit', true);
    apiCall('PATCH','/me', {firstName:val('pr-first'), lastName:val('pr-last'), birthDate:val('pr-birth')}).then(function(r){ AUTH.user=r.user; saveAuth(AUTH); render(false); toast('Данные сохранены'); })
      .catch(function(e){ setBtn('pr-submit', false); formMsg('pr-msg', e.message, true); });
  },
  'pw-form': function(){
    var cur=(document.getElementById('pw-cur')||{}).value||'', nx=(document.getElementById('pw-new')||{}).value||'';
    if(!cur){ formMsg('pw-msg','Введите текущий пароль', true); return; }
    if(nx.length<8){ formMsg('pw-msg','Новый пароль не короче 8 символов', true); return; }
    setBtn('pw-submit', true);
    apiCall('POST','/me/password', {current:cur, next:nx}).then(function(r){ AUTH.user=r.user; saveAuth(AUTH); render(false); toast('Пароль изменен. На других устройствах войдите заново'); })
      .catch(function(e){ setBtn('pw-submit', false); formMsg('pw-msg', e.message, true); });
  },
  'del-form': function(){
    var pw=(document.getElementById('del-pw')||{}).value||'';
    if(!pw){ formMsg('del-msg','Введите пароль', true); return; }
    setBtn('del-submit', true);
    apiCall('DELETE','/me', {password:pw}).then(function(){ signOutLocal(); go('plan'); toast('Аккаунт и данные удалены'); })
      .catch(function(e){ setBtn('del-submit', false); formMsg('del-msg', e.message, true); });
  }
};
function setMarketing(box){
  var want=!!box.checked;
  apiCall('PATCH','/me', {marketingConsent:want}).then(function(r){ AUTH.user=r.user; saveAuth(AUTH); toast(want?'Спасибо! Будем присылать полезное':'Вы отказались от рекламных сообщений'); })
    .catch(function(e){ box.checked=!want; toast(e.message); });
}
function doLogout(){
  var a=AUTH; if(!a) return;
  var done=function(){ apiCall('POST','/auth/logout', {}, a.token).catch(function(){}); signOutLocal(); go('plan'); toast('Вы вышли из аккаунта'); };
  syncNow().then(done, done);
}
function doLogoutAll(){
  var a=AUTH; if(!a) return;
  syncNow().then(function(){ return apiCall('POST','/auth/logout-all', {}, a.token); }).then(function(){ signOutLocal(); go('plan'); toast('Вы вышли на всех устройствах'); })
    .catch(function(e){ toast(e.message); });
}
function refreshMe(){
  return apiCall('GET','/state').then(function(r){
    var before=JSON.stringify(AUTH.user);
    AUTH.user=r.user; saveAuth(AUTH);
    if(!S.owner) S.owner=r.user.id;
    var changed=applyRemote(r.state);
    if(changed || before!==JSON.stringify(r.user)) { if(!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(false); }
    syncSoon(1500);
  }).catch(function(e){
    if(e.status===401 || e.code==='blocked') sessionEnded(e.code==='blocked'?'Аккаунт заблокирован. Обратитесь в поддержку':'Сессия завершена, войдите снова');
    else if(e.code==='must_change'){ AUTH.user.mustChangePassword=true; saveAuth(AUTH); render(); }
  });
}
if(ONLINE){
  window.addEventListener('online', function(){ syncSoon(500); });
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && AUTH && Date.now()-SY.last>60000) refreshMe(); });
  setInterval(function(){ if(AUTH && Date.now()-SY.last>600000) syncSoon(0); }, 120000);
}

/* ---------- timer ---------- */
setInterval(function(){
  if(!S.exam) return;
  var left=examLeft();
  if(left<=0){ finishExam(true); return; }
  var els=document.querySelectorAll('[data-timer]');
  for(var i=0;i<els.length;i++){ els[i].textContent=mmss(left); if(left<300) els[i].classList.add('low'); }
}, 1000);

/* an exam in progress may reference questions removed in a content update: drop them and refill to 40 */
function sanitizeExam(){
  var E=S.exam; if(!E || !E.ids) return;
  var ids=E.ids.filter(function(id){ return !!Q[id]; });
  if(ids.length===E.ids.length) return;
  var pool=shuffle(CORE.filter(function(id){ return ids.indexOf(id)<0; }));
  while(ids.length<40 && pool.length) ids.push(pool.pop());
  var ans={}; Object.keys(E.ans||{}).forEach(function(k){ if(Q[k] && ids.indexOf(k)>=0) ans[k]=E.ans[k]; });
  E.ids=ids; E.ans=ans; if(!(E.cur<ids.length)) E.cur=0; E.sel=null; flush();
}
sanitizeExam();
if(S.exam && examLeft()<=0){ finishExam(true); }
render();
window.__pgOff=1;   // нажатие на кнопку первого экрана из HTML, сделанное до запуска приложения
if(window.__pg){ var pgTo=window.__pg; window.__pg=null; if(pgTo!==R.v) go(pgTo); }
document.documentElement.setAttribute('data-ready','1');
if(ONLINE){ loadConfig(); if(AUTH) refreshMe(); }
if(!sceneReady()){ var prefetchScene=function(){ setTimeout(function(){ var go=function(){ loadScene(); }; if(window.requestIdleCallback) requestIdleCallback(go,{timeout:15000}); else go(); }, 8000); }; if(document.readyState==='complete') prefetchScene(); else window.addEventListener('load', prefetchScene); }   // схемы подгружаются в простое, когда нужны раньше - сразу
})();
