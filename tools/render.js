// Usage: node tools/render.js <input.json> <out.html> [idsCommaSeparated]
// Input: module file ({questions:[...]}) , extra file ({module, questions}) or array of {id,q,options,answer,scene,sign}
const fs=require('fs'), path=require('path');
const S=require('../src/scene.js');
const base=path.join(__dirname,'..','content');
const catalog={};
function addSigns(f){ if(fs.existsSync(f)) JSON.parse(fs.readFileSync(f,'utf8')).forEach(s=>catalog[s.code]=s.svg); }
addSigns(path.join(base,'signs.json')); addSigns(path.join(base,'extra','signs-extra.json'));
const [,,inp,out,ids]=process.argv;
let data=JSON.parse(fs.readFileSync(inp,'utf8'));
let qs=Array.isArray(data)?data:(data.questions||[]);
if(ids){ const set=new Set(ids.split(',')); qs=qs.filter(q=>set.has(q.id)); }
qs=qs.filter(q=>q.scene||q.sign);
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
let cards=qs.map(q=>{
  let pic='';
  if(q.scene){ pic=S.render(q.scene,catalog); if(!pic) pic='<div style="color:#c00;font-weight:700">RENDER FAILED</div>'; }
  else if(q.sign){ pic=catalog[q.sign]?catalog[q.sign].replace('<svg','<svg width="140" height="140"'):'<div style="color:#c00">UNKNOWN SIGN '+esc(q.sign)+'</div>'; }
  const cap=q.scene?S.caption(q.scene):'';
  const opts=(q.options||[]).map((o,i)=>'<li'+(i===q.answer?' class="ok"':'')+'>'+esc(o)+'</li>').join('');
  const anim=q.scene&&q.scene.anim?'<div class="anim">anim: '+esc(JSON.stringify(q.scene.anim))+'</div>':'';
  return '<div class="card"><div class="id">'+esc(q.id)+'</div><div class="pic">'+pic+'</div>'+(cap?'<div class="cap">'+esc(cap)+'</div>':'')+'<div class="q">'+esc(q.q||'')+'</div><ol type="A">'+opts+'</ol>'+anim+'</div>';
}).join('');
const html='<!doctype html><meta charset="utf-8"><style>body{font:12px Arial,sans-serif;margin:10px;background:#eee}.grid{display:grid;grid-template-columns:repeat(3,360px);gap:10px}.card{background:#fff;border-radius:8px;padding:8px}.id{font-weight:700;color:#555}.pic svg{width:340px;height:340px;display:block}.cap{font-size:11px;color:#333;margin:2px 0 4px;font-weight:700}.q{font-weight:700;margin:4px 0}ol{margin:2px 0 0 18px;padding:0}li.ok{color:#0a7a3a;font-weight:700}.anim{color:#777;font-size:10px;margin-top:4px}</style><div class="grid">'+cards+'</div>';
fs.writeFileSync(out,html);
console.log(JSON.stringify({rendered:qs.length,out}));
