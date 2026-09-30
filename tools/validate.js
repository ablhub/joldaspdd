// Usage: node tools/validate.js <file.json> [<file2.json> ...]   (or --all)
// Validates question files (module files content/mNN.json or extra files content/extra/*.json)
const fs=require('fs'), path=require('path');
const S=require('../src/scene.js');
const base=path.join(__dirname,'..','content');
const catalog={};
function addSigns(f){ if(fs.existsSync(f)) JSON.parse(fs.readFileSync(f,'utf8')).forEach(s=>catalog[s.code]=s.svg); }
addSigns(path.join(base,'signs.json')); addSigns(path.join(base,'extra','signs-extra.json'));
let files=process.argv.slice(2);
function allFiles(){ return fs.readdirSync(base).filter(f=>/^m\d\d\.json$/.test(f)).map(f=>path.join(base,f)).concat(fs.existsSync(path.join(base,'extra'))?fs.readdirSync(path.join(base,'extra')).filter(f=>/^m\d\d-.*\.json$/.test(f)).map(f=>path.join(base,'extra',f)):[]); }
if(files[0]==='--all') files=allFiles();
const KINDS=Object.keys(S.DIMS), COLORS=['red','blue','white','green','yellow','black','orange','gray'];
const TYPES=['yield','order','path','park','situation','sign','marking','signal','fact','fine','aid','safety','procedure'];
const CATS=['A','B','C','D','T'];
const ARMS=['N','E','S','W'], ANG={S:0,W:90,N:180,E:270}, BYANG={0:'S',90:'W',180:'N',270:'E'};
function dest(a,turn){ const d={straight:180,right:270,left:90,u:0}[turn]; return BYANG[(ANG[a]+d)%360]; }
let errors=[], warns=[];
function E(id,m){ errors.push(id+': '+m); } function Wn(id,m){ warns.push(id+': '+m); }
function checkSign(id,c){ if(!S.knownSign(c,catalog)) E(id,'unknown sign code '+JSON.stringify(c)); }
function checkVeh(id,v){ if(v.kind&&KINDS.indexOf(v.kind)<0) E(id,'unknown vehicle kind '+v.kind); if(v.color&&COLORS.indexOf(v.color)<0) E(id,'unknown color '+v.color); }
function checkScene(id,sc,q){
  if(!sc||typeof sc!=='object'){ E(id,'scene not an object'); return; }
  const ids=new Set(), movers=new Set(); let me=0;
  const cars=sc.cars||[];
  cars.forEach(v=>{ if(v.id){ if(ids.has(v.id)) E(id,'duplicate car id '+v.id); ids.add(v.id);} if(v.me) me++; checkVeh(id,v); });
  (sc.parked||[]).forEach(v=>{ if(v.id) ids.add(v.id); checkVeh(id,v); if(v.me) me++; });
  if(me>1) E(id,'more than one car has me:true');
  S.signCodes(sc).forEach(c=>checkSign(id,c));
  if(sc.type==='cross'||sc.type==='t'){
    const arms=sc.arms||ARMS; if(arms.length<3||arms.some(a=>ARMS.indexOf(a)<0)) E(id,'bad arms');
    const LNS=sc.lanesNS||sc.lanes||1, LEW=sc.lanesEW||sc.lanes||1; if([1,2].indexOf(LNS)<0||[1,2].indexOf(LEW)<0) E(id,'lanes must be 1 or 2');
    const nl=a=>(a==='N'||a==='S')?LNS:LEW;
    ['signs','lights','surface','laneArrows','centerByArm'].forEach(k=>{ if(sc[k]) Object.keys(sc[k]).forEach(a=>{ if(arms.indexOf(a)<0) E(id,k+' refers to missing arm '+a); }); });
    if(sc.main){ if(!Array.isArray(sc.main)||sc.main.some(a=>arms.indexOf(a)<0)) E(id,'main must list existing arms'); }
    const sigs=sc.signs||{}; Object.keys(sigs).forEach(a=>{ const cs=Array.isArray(sigs[a])?sigs[a]:[sigs[a]]; if(cs.indexOf('7.13')>=0&&!sc.main) E(id,'7.13 plate needs scene.main'); });
    const slots={};
    cars.forEach(v=>{ const a=v.arm||'S'; if(arms.indexOf(a)<0) E(id,'car '+(v.id||'?')+' on missing arm '+a);
      if(v.lane&&v.lane>nl(a)) E(id,'car '+(v.id||'?')+' lane '+v.lane+' > lanes '+nl(a));
      if(v.at&&['stop','near','far','in','exit'].indexOf(v.at)<0) E(id,'bad at '+v.at);
      if(v.turn){ if(['straight','left','right','u'].indexOf(v.turn)<0) E(id,'bad turn '+v.turn); else if(arms.indexOf(dest(a,v.turn))<0) E(id,'car '+(v.id||'?')+' turn '+v.turn+' from '+a+' leads to missing arm'); if(v.id) movers.add(v.id); }
      if(v.at==='exit'&&v.id) movers.add(v.id);
      (v.paths||[]).forEach(p=>{ if(['straight','left','right','u'].indexOf(p.turn)<0) E(id,'bad path turn'); else if(arms.indexOf(dest(a,p.turn))<0) E(id,'path leads to missing arm'); });
      const key=a+'|'+(v.lane||1)+'|'+(v.at||'stop')+'|'+(v.dist||0); if(v.at!=='in'&&v.at!=='exit'){ if(slots[key]) E(id,'two vehicles in the same spot on arm '+a); slots[key]=1; }
    });
  } else if(sc.type==='round'){
    const arms=sc.arms||ARMS;
    cars.forEach(v=>{ if(v.ring!=null){ if(v.exit){ if(arms.indexOf(v.exit)<0) E(id,'ring exit to missing arm'); else if(v.id) movers.add(v.id); } return; } const a=v.arm||'S'; if(arms.indexOf(a)<0) E(id,'car on missing arm'); if(v.turn){ if(arms.indexOf(dest(a,v.turn))<0) E(id,'round turn to missing arm'); if(v.id) movers.add(v.id);} });
  } else if(sc.type==='road'||sc.type==='rail'){
    const U=sc.up==null?1:sc.up, D=sc.down==null?1:sc.down; if(U<1||U>3||D<0||D>3) E(id,'up 1..3, down 0..3');
    const okLane=l=>{ if(!l) return true; const m=/^([ud])(\d)$/.exec(l); if(!m) return false; const k=+m[2]; return m[1]==='u'?k>=1&&k<=U:k>=1&&k<=D; };
    if(sc.busLane&&!okLane(sc.busLane)) E(id,'bad busLane');
    const AR=['straight','left','right','u','overtake','bypass','change-left','change-right','stop-right','park-right','stop-left','reverse'];
    cars.forEach(v=>{ if(v.side==null&&!okLane(v.lane)) E(id,'bad lane '+v.lane); if(v.side!=null&&!(sc.side||[])[v.side]) E(id,'car.side index not in scene.side'); if(v.arrow){ if(AR.indexOf(v.arrow)<0) E(id,'bad arrow '+v.arrow); else if(v.id&&v.arrow!=='reverse') movers.add(v.id); } (v.paths||[]).forEach(p=>{ if(AR.indexOf(p.arrow)<0) E(id,'bad path arrow'); }); if(v.y!=null&&(v.y<0||v.y>1)) E(id,'y must be 0..1'); });
    (sc.signs||[]).forEach(g=>{ if(g.y==null) E(id,'road sign needs y'); });
    (sc.marks||[]).forEach(m=>{ if(['crosswalk','stopline','yield','yellow-edge','zigzag','arrows','hatch'].indexOf(m.type)<0) E(id,'bad mark type '+m.type); if(m.type==='arrows'&&!okLane(m.lane)) E(id,'bad arrows lane'); });
    (sc.obstacles||[]).forEach(o=>{ if(!okLane(o.lane)) E(id,'bad obstacle lane'); });
  } else if(sc.type==='signal'){
    (sc.items||[]).forEach(it=>{ if(['car','ped','rev','rail','tram'].indexOf(it.kind||'car')<0) E(id,'bad signal kind'); });
    if(!(sc.items||[]).length) E(id,'signal needs items');
  } else if(sc.type==='signs'){
    if(!(sc.items||[]).length) E(id,'signs needs items');
  } else E(id,'unknown scene type '+sc.type);
  if(sc.anim){ if(!Array.isArray(sc.anim)) E(id,'anim must be array of arrays'); else sc.anim.forEach(st=>{ (Array.isArray(st)?st:[st]).forEach(cid=>{ if(!ids.has(cid)) E(id,'anim refers to unknown car '+cid); else if(!movers.has(cid)) E(id,'anim car '+cid+' has no turn/arrow to move along'); }); }); }
  const svg=S.render(sc,catalog); if(!svg) E(id,'render failed');
}
const DASH=/[—–]/;
const allTexts={};
function norm(t){ return String(t||'').toLowerCase().replace(/[^a-zа-яё0-9]+/g,' ').trim(); }
// index existing texts across all files for duplicate detection
allFiles().forEach(fp=>{ try{ const d=JSON.parse(fs.readFileSync(fp,'utf8')); (d.questions||[]).forEach(q=>{ const k=norm(q.q)+'|'+(q.options||[]).map(norm).sort().join('|')+'|'+JSON.stringify(q.scene||q.sign||''); (allTexts[k]=allTexts[k]||[]).push(q.id); }); }catch(e){} });
let stats={files:0,questions:0,withScene:0,withSign:0,types:{},cats:{}};
const seenIds={};
allFiles().forEach(fp=>{ try{ JSON.parse(fs.readFileSync(fp,'utf8')).questions.forEach(q=>{ (seenIds[q.id]=seenIds[q.id]||[]).push(path.basename(fp)); }); }catch(e){} });
files.forEach(fp=>{
  let d; try{ d=JSON.parse(fs.readFileSync(fp,'utf8')); }catch(e){ E(path.basename(fp),'invalid JSON: '+e.message); return; }
  stats.files++;
  const raw=fs.readFileSync(fp,'utf8'); if(DASH.test(raw)) E(path.basename(fp),'contains long/en dash');
  const qs=d.questions||[]; if(!Array.isArray(qs)) { E(path.basename(fp),'questions must be array'); return; }
  if(/extra/.test(fp) && !/^m\d\d$/.test(d.module||'')) E(path.basename(fp),'extra file needs "module": "mNN"');
  qs.forEach(q=>{
    const id=q.id||'?'; stats.questions++;
    if(!/^m\d\d-[a-z0-9-]+$/.test(id)) E(id,'bad id format');
    if(seenIds[id]&&seenIds[id].length>1) E(id,'duplicate id in '+seenIds[id].join(', '));
    if(typeof q.q!=='string'||q.q.length<8||q.q.length>420) E(id,'q length');
    if(!Array.isArray(q.options)||q.options.length<2||q.options.length>5) E(id,'options must be 2..5');
    else { const n=q.options.map(norm); if(new Set(n).size!==n.length) E(id,'duplicate options'); q.options.forEach(o=>{ if(typeof o!=='string'||!o.trim()) E(id,'empty option'); if(/все (ответы|варианты) верн/i.test(o)) Wn(id,'avoid "все ответы верны"'); }); }
    if(!Number.isInteger(q.answer)||!q.options||q.answer<0||q.answer>=q.options.length) E(id,'answer index out of range');
    if(typeof q.explain!=='string'||q.explain.length<15) E(id,'explain missing/short');
    if(!q.ref) E(id,'ref missing');
    if(q.difficulty&&[1,2,3].indexOf(q.difficulty)<0) E(id,'difficulty 1..3');
    if(q.type){ if(TYPES.indexOf(q.type)<0) E(id,'unknown type '+q.type); stats.types[q.type]=(stats.types[q.type]||0)+1; }
    if(q.cats){ if(!Array.isArray(q.cats)||q.cats.some(c=>CATS.indexOf(c)<0)) E(id,'cats must be subset of '+CATS.join(',')); q.cats.forEach(c=>stats.cats[c]=(stats.cats[c]||0)+1); }
    if(q.sign){ checkSign(id,q.sign); stats.withSign++; }
    if(q.scene){ checkScene(id,q.scene,q); stats.withScene++; }
    const k=norm(q.q)+'|'+(q.options||[]).map(norm).sort().join('|')+'|'+JSON.stringify(q.scene||q.sign||'');
    if(allTexts[k]&&allTexts[k].length>1&&allTexts[k][0]!==id) Wn(id,'looks like a duplicate of '+allTexts[k].filter(x=>x!==id).join(','));
  });
});
console.log(JSON.stringify(stats));
if(warns.length) console.log('WARNINGS ('+warns.length+'):\n'+warns.slice(0,80).join('\n'));
if(errors.length){ console.log('ERRORS ('+errors.length+'):\n'+errors.slice(0,200).join('\n')); process.exit(1); } else console.log('OK: no errors');
