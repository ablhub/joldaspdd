/* PDD scene renderer v2: declarative traffic situations -> SVG string (browser + Node). */
(function(root){
'use strict';
var W=240, C=120, LW=16;
var COL={grass:'#CFDDBF',grass2:'#C3D3B1',asph:'#5B6168',dirt:'#A58E6B',dirt2:'#8F7A58',walk:'#D9DDE0',curb:'#8E969C',strip:'#9DBB83',rail:'#3A3F44',sleeper:'#8B6B4A',txt:'#1D2329',yel:'#F2B200'};
var CARC={red:'#D62D20',blue:'#2F6FD6',white:'#F1F3F5',green:'#2E9E5B',yellow:'#F2B200',black:'#2A2E33',orange:'#F07F16',gray:'#A3ABB2'};
var ARC={red:'#D62D20',blue:'#1E55C2',green:'#1E8A4C',black:'#111111',orange:'#E06A00'};
var RUCOL={red:'красный',blue:'синий',white:'белый',green:'зеленый',yellow:'желтый',black:'черный',orange:'оранжевый',gray:'серый'};
var DIMS={car:[11,11],taxi:[11,11],police:[11,11],ambulance:[11,11],truck:[17,17],fire:[17,17],bus:[20,20],trolleybus:[20,20],tram:[26,26],moto:[7,7],moped:[6,6],bike:[7,7],scooter:[6,6],tractor:[12,10],'car-trailer':[11,29],'truck-trailer':[17,45],semi:[17,33],'bus-art':[20,38]};
var uid=0;
function f(n){return (Math.round(n*10)/10).toString();}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var ANG={S:0,W:90,N:180,E:270};
function rot(p,a){ if(!a) return [p[0],p[1]]; var r=a*Math.PI/180, dx=p[0]-C, dy=p[1]-C; return [C+dx*Math.cos(r)-dy*Math.sin(r), C+dx*Math.sin(r)+dy*Math.cos(r)]; }
function dims(k){ return DIMS[k]||DIMS.car; }
function pathStr(cmds){ return cmds.map(function(c){ return c[0]+c.slice(1).map(function(p){return f(p[0])+' '+f(p[1]);}).join(' '); }).join(' '); }
function rotCmds(cmds,a){ return cmds.map(function(c){ return [c[0]].concat(c.slice(1).map(function(p){return rot(p,a);})); }); }
function lastPt(cmds){ var c=cmds[cmds.length-1]; return c[c.length-1]; }

/* ---------- vehicles (drawn heading up, centred at 0,0) ---------- */
function shape(v){
  var kind=v.kind||'car', col=CARC[v.color]||(v.me?CARC.red:CARC.blue), st=' stroke="#1B1F23" stroke-width="0.8"', g='';
  function carBody(y0, body){ return '<rect x="-6" y="'+(y0-11)+'" width="12" height="22" rx="3.2" fill="'+body+'"'+st+'/><rect x="-4.6" y="'+(y0-6.2)+'" width="9.2" height="4" rx="1.2" fill="#2E3A46"/><rect x="-4.6" y="'+(y0+5.2)+'" width="9.2" height="3" rx="1" fill="#2E3A46"/><rect x="-5" y="'+(y0-11.4)+'" width="2.6" height="1.4" rx=".6" fill="#FFE9A8"/><rect x="2.4" y="'+(y0-11.4)+'" width="2.6" height="1.4" rx=".6" fill="#FFE9A8"/>'; }
  if(kind==='car'||kind==='police'||kind==='ambulance'||kind==='taxi'||kind==='car-trailer'){
    var body = (kind==='police'||kind==='ambulance') ? '#F4F6F8' : (kind==='taxi'?CARC.yellow:col);
    g+=carBody(0, body);
    if(kind==='police') g+='<rect x="-6" y="-1.5" width="12" height="3" fill="#1E55C2"/>';
    if(kind==='ambulance') g+='<path d="M-1.2 -2.2h2.4v1.4h1.4v2.4h-1.4v1.4h-2.4v-1.4h-1.4v-2.4h1.4z" fill="#D62D20"/>';
    if(kind==='taxi') g+='<rect x="-3" y="-1.2" width="6" height="2.4" fill="#1B1F23"/>';
    if(kind==='car-trailer') g+='<path d="M0 11v4" stroke="#1B1F23" stroke-width="1.4"/><rect x="-6.5" y="15" width="13" height="14" rx="1.5" fill="#C9CED3"'+st+'/>';
  } else if(kind==='truck'||kind==='fire'||kind==='truck-trailer'||kind==='semi'){
    var bc = kind==='fire'?'#D62D20':col;
    g+='<rect x="-7" y="-17" width="14" height="8" rx="2" fill="'+bc+'"'+st+'/><rect x="-5.5" y="-15.6" width="11" height="3" rx="1" fill="#2E3A46"/>';
    if(kind==='semi') g+='<rect x="-7.4" y="-7" width="14.8" height="40" rx="1.2" fill="#D5DADF"'+st+'/>';
    else g+='<rect x="-7.4" y="-8" width="14.8" height="25" rx="1.2" fill="'+(kind==='fire'?'#B8241A':'#D5DADF')+'"'+st+'/>';
    if(kind==='fire') g+='<path d="M-3 -6v20M3 -6v20M-3 0h6M-3 6h6M-3 12h6" stroke="#E8E8E8" stroke-width="1"/>';
    if(kind==='truck-trailer') g+='<path d="M0 17v4" stroke="#1B1F23" stroke-width="1.6"/><rect x="-7.4" y="21" width="14.8" height="24" rx="1.2" fill="#D5DADF"'+st+'/>';
  } else if(kind==='bus'||kind==='trolleybus'){
    g+='<rect x="-7" y="-20" width="14" height="40" rx="2.5" fill="'+(v.color?col:(kind==='trolleybus'?'#2F6FD6':'#F2B200'))+'"'+st+'/><rect x="-5.6" y="-18.4" width="11.2" height="4" rx="1" fill="#2E3A46"/><path d="M-7 -10h14M-7 0h14M-7 10h14" stroke="#1B1F23" stroke-width=".5" opacity=".5"/>';
    if(kind==='trolleybus') g+='<path d="M-2.5 2L-4 26M2.5 2L4 26" stroke="#1B1F23" stroke-width="1.1"/>';
  } else if(kind==='bus-art'){
    g+='<rect x="-7" y="-20" width="14" height="27" rx="2.5" fill="'+(v.color?col:'#F2B200')+'"'+st+'/><rect x="-6" y="7" width="12" height="3" fill="#2A2E33"/><rect x="-7" y="10" width="14" height="28" rx="2.5" fill="'+(v.color?col:'#F2B200')+'"'+st+'/><rect x="-5.6" y="-18.4" width="11.2" height="4" rx="1" fill="#2E3A46"/>';
  } else if(kind==='tram'){
    g+='<rect x="-7" y="-26" width="14" height="52" rx="3" fill="'+(v.color?col:'#E53935')+'"'+st+'/><rect x="-5.6" y="-24" width="11.2" height="4" rx="1" fill="#2E3A46"/><path d="M-7 -9h14M-7 8h14" stroke="#1B1F23" stroke-width=".7"/>';
  } else if(kind==='moped'){
    g+='<ellipse cx="0" cy="0" rx="2.2" ry="5.6" fill="'+col+'"'+st+'/><circle cx="0" cy="1" r="2.5" fill="#2A2E33"/><path d="M-3 -4H3" stroke="#1B1F23" stroke-width="1"/>';
  } else if(kind==='moto'){
    g+='<ellipse cx="0" cy="0" rx="2.6" ry="7" fill="'+col+'"'+st+'/><circle cx="0" cy="1" r="2.8" fill="#2A2E33"/>';
  } else if(kind==='bike'||kind==='scooter'){
    g+='<path d="M0 -6V6" stroke="#1B1F23" stroke-width="1.6"/><path d="M-3 -4H3" stroke="#1B1F23" stroke-width="1.2"/><circle cx="0" cy="1" r="2.8" fill="'+col+'" stroke="#1B1F23" stroke-width=".6"/>';
  } else if(kind==='tractor'){
    g+='<rect x="-7" y="-4" width="14" height="14" rx="2" fill="#2E9E5B"'+st+'/><rect x="-4" y="-12" width="8" height="8" rx="1.5" fill="#2E9E5B"'+st+'/><rect x="-9" y="1" width="3" height="9" fill="#1B1F23"/><rect x="6" y="1" width="3" height="9" fill="#1B1F23"/>';
  }
  var fr=dims(kind)[0];
  if(v.flash){
    var fy=-fr+8, c2=v.flash==='orange'?'#F07F16':'#D62D20', c1=v.flash==='orange'?'#F07F16':'#2F6FD6';
    g+='<circle cx="-3" cy="'+fy+'" r="4.4" fill="'+c1+'" opacity=".35"/><circle cx="3" cy="'+fy+'" r="4.4" fill="'+c2+'" opacity=".35"/><circle cx="-2" cy="'+fy+'" r="1.7" fill="'+c1+'"/><circle cx="2" cy="'+fy+'" r="1.7" fill="'+c2+'"/>';
  }
  var bk=dims(kind)[1];
  if(v.hazard){ g+='<circle cx="-5.5" cy="'+(-fr+.6)+'" r="2" fill="#F07F16"/><circle cx="5.5" cy="'+(-fr+.6)+'" r="2" fill="#F07F16"/><circle cx="-5.5" cy="'+(bk-.6)+'" r="2" fill="#F07F16"/><circle cx="5.5" cy="'+(bk-.6)+'" r="2" fill="#F07F16"/>'; }
  if(v.signal==='left'||v.signal==='right'){ var sx=v.signal==='left'?-5.8:5.8; g+='<circle cx="'+sx+'" cy="'+(-fr+.6)+'" r="2.2" fill="#F07F16"/><circle cx="'+sx+'" cy="'+(Math.min(bk,11)-.6)+'" r="2.2" fill="#F07F16"/>'; }
  if(v.brake){ var by=Math.min(bk,11)-1; g+='<rect x="-5.5" y="'+by+'" width="3" height="1.8" fill="#FF2A1A"/><rect x="2.5" y="'+by+'" width="3" height="1.8" fill="#FF2A1A"/>'; }
  return g;
}
function vehicle(v, x, y, heading, ctx, mpath){
  var id=v.id||('v'+(++ctx.vseq));
  var g='<g class="veh" data-car="'+esc(id)+'"'+(mpath?' data-mpath="'+mpath+'"':'')+' data-x="'+f(x)+'" data-y="'+f(y)+'" data-h="'+f(heading)+'">';
  if(v.focus) g+='<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+(dims(v.kind)[0]+9)+'" fill="none" stroke="#F2B200" stroke-width="2.2" stroke-dasharray="4 3"/>';
  g+='<g class="vb" transform="translate('+f(x)+' '+f(y)+') rotate('+f(heading)+')">'+shape(v)+'</g>';
  if(v.label){ g+='<g class="vl" transform="translate('+f(x)+' '+f(y)+')"><circle r="5.6" fill="#FFFFFF" stroke="#1B1F23" stroke-width=".9"/><text y="2.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="700" fill="#1B1F23">'+esc(v.label)+'</text></g>'; }
  return g+'</g>';
}

/* ---------- arrows & paths ---------- */
function arrowColor(v){ if(v.me) return ARC.red; if(v.arrowColor&&ARC[v.arrowColor]) return ARC[v.arrowColor]; var c=v.color||'blue'; return ARC[c]||ARC.blue; }
function marker(col, ctx){ var id='ah'+ctx.id+'_'+col.replace('#',''); if(ctx.markers.indexOf(id)<0){ ctx.markers.push(id); ctx.defs+='<marker id="'+id+'" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+col+'" stroke="#fff" stroke-width="1"/></marker>'; } return id; }
function arrowPath(d, col, ctx){ var id=marker(col,ctx); return '<path class="arr" d="'+d+'" fill="none" stroke="#FFFFFF" stroke-width="4.6" stroke-linecap="round" opacity=".9"/><path class="arr" d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-linecap="round" marker-end="url(#'+id+')"/>'; }
function trajPath(d, lab, end, ctx){ var id=marker('#1B1F23',ctx); return '<path d="'+d+'" fill="none" stroke="#FFFFFF" stroke-width="4.4" stroke-linecap="round"/><path d="'+d+'" fill="none" stroke="#1B1F23" stroke-width="2" stroke-linecap="round" marker-end="url(#'+id+')"/>'+(lab?label(end[0], end[1]-7, lab, 9):''); }
function motion(cmds, startPt, ext, ctx){
  var id='mp'+ctx.id+'_'+(++ctx.mseq);
  var all=[['M',startPt]].concat(cmds.map(function(c,i){ return i===0? ['L',c[1]] : c; }));
  if(ext) all.push(['L',ext]);
  ctx.mpaths+='<path id="'+id+'" class="mpath" d="'+pathStr(all)+'" fill="none" stroke="none"/>';
  return id;
}
function extend(p, dir){ return [p[0]+dir[0]*160, p[1]+dir[1]*160]; }

/* ---------- small upright icons ---------- */
function signIcon(code, x, y, size, ctx){
  var svg = ctx.sign(code); size=size||20;
  var inner = svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  var vb = (svg.match(/viewBox=['"]([^'"]+)['"]/)||[0,'0 0 100 100'])[1].split(/[\s,]+/).map(Number);
  var sc = size/Math.max(vb[2],vb[3]);
  var w=vb[2]*sc, h=vb[3]*sc;
  return '<g transform="translate('+f(x-w/2)+' '+f(y-h/2)+') scale('+sc.toFixed(4)+') translate('+(-vb[0])+' '+(-vb[1])+')">'+inner+'</g>';
}
function isPlateCode(c){ return typeof c==='object' || /^7\./.test(String(c)) || /^p:/.test(String(c)); }
function signStack(codes, x, y, ctx, size){
  size=size||20; if(!Array.isArray(codes)) codes=[codes];
  var hs=codes.map(function(c){ return isPlateCode(c)?size*0.64:size; }), tot=hs.reduce(function(a,b){return a+b+2;},0);
  var s='<rect x="'+f(x-0.8)+'" y="'+f(y)+'" width="1.6" height="'+f(tot+6)+'" fill="#6B737A"/>', cy=y;
  codes.forEach(function(c,i){ s+=signIcon(c, x, cy+hs[i]/2, isPlateCode(c)?size*1.05:size, ctx); cy+=hs[i]+2; });
  return s;
}
function lamp(cx,cy,r,color,on,flash,shp){
  var off={red:'#4A2522',yellow:'#4A3F1E',green:'#1E3D2B',white:'#3E4247'}[color]||'#333';
  var onc={red:'#FF3B2F',yellow:'#FFC21A',green:'#2BD46E',white:'#F4F6F8'}[color]||'#fff';
  var s='';
  if(on && flash) s+='<circle cx="'+f(cx)+'" cy="'+f(cy)+'" r="'+f(r*1.9)+'" fill="none" stroke="'+onc+'" stroke-width="'+f(r*0.35)+'" stroke-dasharray="'+f(r*0.5)+' '+f(r*0.45)+'"/>';
  if(shp){
    s+='<circle cx="'+f(cx)+'" cy="'+f(cy)+'" r="'+f(r)+'" fill="#15181B"/>';
    var a={left:270,right:90,up:0,straight:0,down:180}[shp]||0;
    s+='<g transform="translate('+f(cx)+' '+f(cy)+') rotate('+a+') scale('+f(r/10)+')"><path d="M0 -8L7 0H3V8H-3V0H-7Z" fill="'+(on?onc:off)+'"/></g>';
  } else s+='<circle cx="'+f(cx)+'" cy="'+f(cy)+'" r="'+f(r)+'" fill="'+(on?onc:off)+'"/>';
  return s;
}
function lightState(st){ if(typeof st==='string') st={on:[st]}; st=st||{}; var on=st.on||[]; if(typeof on==='string') on=[on]; return {on:on, flash:st.flash||[], arrows:st.arrows||{}, shape:st.shape||{}}; }
function smallLight(st, x, y){
  st=lightState(st);
  var s='<g><rect x="'+f(x-4.8)+'" y="'+f(y-12.5)+'" width="9.6" height="25" rx="2.2" fill="#1C1F22"/>';
  ['red','yellow','green'].forEach(function(c,i){ s+=lamp(x, y-7.4+i*7.4, 2.7, c, st.on.indexOf(c)>=0, st.flash.indexOf(c)>=0, st.shape[c]); });
  var ax=x+8; Object.keys(st.arrows).forEach(function(dir){ s+='<rect x="'+f(ax-3.8)+'" y="'+f(y+7.4-3.8)+'" width="7.6" height="7.6" rx="1.6" fill="#1C1F22"/>'+lamp(ax, y+7.4, 2.7, 'green', st.arrows[dir]!=='off', st.arrows[dir]==='flash', dir); ax+=8; });
  return s+'</g>';
}
function person(x,y,dir,col){
  var a={up:0,right:90,down:180,left:270}[dir]||0;
  return '<g class="ped" transform="translate('+f(x)+' '+f(y)+') rotate('+a+')"><ellipse cx="0" cy="0" rx="4.4" ry="2.6" fill="'+(col?(CARC[col]||col):'#2F6FD6')+'" stroke="#1B1F23" stroke-width=".6"/><circle cx="0" cy="-0.4" r="2" fill="#F1C9A5" stroke="#1B1F23" stroke-width=".5"/></g>';
}
function label(x,y,t,size,anchor){ size=size||8; return '<text x="'+f(x)+'" y="'+f(y)+'" text-anchor="'+(anchor||'middle')+'" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="700" fill="'+COL.txt+'" stroke="#FFFFFF" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">'+esc(t)+'</text>'; }
function obstacle(x,y){ return '<g transform="translate('+f(x)+' '+f(y)+')"><path d="M-5 5L0 -6L5 5Z" fill="#F07F16" stroke="#1B1F23" stroke-width=".6"/><path d="M-3 1h6" stroke="#fff" stroke-width="1.4"/></g>'; }
function tree(x,y,r){ r=r||7; return '<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+r+'" fill="#6E9B55" stroke="#557A40" stroke-width="1.2"/><circle cx="'+f(x-r*0.3)+'" cy="'+f(y-r*0.3)+'" r="'+f(r*0.45)+'" fill="#86B36A"/>'; }
function house(x,y,w,h,c){ return '<rect x="'+f(x)+'" y="'+f(y)+'" width="'+w+'" height="'+h+'" rx="1.5" fill="'+(c||'#B9A48A')+'" stroke="#7D6B55" stroke-width="1"/><path d="M'+f(x)+' '+f(y+h/2)+'H'+f(x+w)+'" stroke="#7D6B55" stroke-width=".8"/>'; }
function decor(area, freeRects){
  /* freeRects: list of [x0,y0,x1,y1] grass areas to decorate */
  var s='';
  (freeRects||[]).forEach(function(r,i){
    var w=r[2]-r[0], h=r[3]-r[1]; if(w<18||h<18) return;
    if(area==='town'){ var bw=Math.min(40,w-10), bh=Math.min(30,h-10); var bx=r[0]+(w-bw)/2, by=r[1]+(h-bh)/2; s+=house(bx,by,bw,bh,['#B9A48A','#A9B7C4','#C4B29A','#B7C0A6'][i%4]); }
    else if(area==='rural'){ var n=Math.max(1,Math.min(3,Math.floor(w*h/1800))); for(var k=0;k<n;k++){ s+=tree(r[0]+w*(0.3+0.4*((k*37+i*13)%10)/10), r[1]+h*(0.25+0.5*((k*53+i*29)%10)/10), 6+((k+i)%3)); } }
  });
  return s;
}
function cop(c){
  var face={N:0,E:90,S:180,W:270}[c.face||'S']; var x=c.x==null?C:c.x, y=c.y==null?C:c.y;
  var s='<circle cx="'+f(x)+'" cy="'+f(y)+'" r="11" fill="#FFFFFF" opacity=".45"/><g transform="translate('+f(x)+' '+f(y)+') rotate('+face+')">';
  var arm='stroke="#1E3A7A" stroke-width="2.6" stroke-linecap="round"';
  if(c.pose==='side'||!c.pose) s+='<path d="M-15 0H15" '+arm+'/>';
  if(c.pose==='rightfwd') s+='<path d="M6 0V-13" '+arm+'/><path d="M-6 0V4" '+arm+'/>';
  if(c.pose==='down') s+='<path d="M-7 0v3M7 0v3" '+arm+'/>';
  s+='<ellipse cx="0" cy="0" rx="7.4" ry="3.6" fill="#2D4E9B" stroke="#1B1F23" stroke-width=".7"/><circle cx="0" cy="0" r="3" fill="#F2F2F2" stroke="#1B1F23" stroke-width=".6"/><path d="M-2 -3.4h4l-2 -2.4z" fill="#1B1F23"/></g>';
  if(c.pose==='up') s+=label(x, y-15, 'рука поднята', 7);
  return s;
}
function lineSeg(p0,p1,type,color){
  var col=color||'#fff', d='M'+f(p0[0])+' '+f(p0[1])+'L'+f(p1[0])+' '+f(p1[1]);
  if(type==='dashed') return '<path d="'+d+'" stroke="'+col+'" stroke-width="1.8" stroke-dasharray="8 7"/>';
  if(type==='warn') return '<path d="'+d+'" stroke="'+col+'" stroke-width="1.8" stroke-dasharray="14 4"/>';
  if(type==='none') return '';
  return '<path d="'+d+'" stroke="'+col+'" stroke-width="1.8"/>';
}
function laneArrow(x,y,dirs,rotA){
  var s='<g transform="translate('+f(x)+' '+f(y)+')'+(rotA?' rotate('+rotA+')':'')+'" fill="#fff"><rect x="-1" y="-2" width="2" height="10"/>';
  (dirs||[]).forEach(function(d){
    if(d==='straight') s+='<path d="M0 -9L3.5 -3H-3.5Z"/><rect x="-1" y="-4" width="2" height="4"/>';
    if(d==='right') s+='<path d="M0 -1H5" stroke="#fff" stroke-width="2"/><path d="M8 -1L3.5 -4.5V2.5Z"/>';
    if(d==='left') s+='<path d="M0 -1H-5" stroke="#fff" stroke-width="2"/><path d="M-8 -1L-3.5 -4.5V2.5Z"/>';
  });
  return s+'</g>';
}
function yieldRow(x0,x1,y){ var s=''; for(var x=x0+2;x<x1-3;x+=6) s+='<path d="M'+f(x)+' '+f(y-3)+'h4l-2 5z" fill="#fff"/>'; return s; }
function rails(x0,y0,x1,y1,dir){
  var s='';
  if(dir==='v'){ var cx=(x0+x1)/2; for(var y=y0;y<y1;y+=6) s+='<rect x="'+(cx-9)+'" y="'+y+'" width="18" height="2" fill="#4B5055" opacity=".6"/>'; s+='<path d="M'+(cx-5)+' '+y0+'V'+y1+'M'+(cx+5)+' '+y0+'V'+y1+'" stroke="#2B2F33" stroke-width="1.4"/>'; }
  else { var cy=(y0+y1)/2; for(var x=x0;x<x1;x+=6) s+='<rect x="'+x+'" y="'+(cy-9)+'" width="2" height="18" fill="#4B5055" opacity=".6"/>'; s+='<path d="M'+x0+' '+(cy-5)+'H'+x1+'M'+x0+' '+(cy+5)+'H'+x1+'" stroke="#2B2F33" stroke-width="1.4"/>'; }
  return s;
}
function mainPlate(o){
  var toView=ANG[o.from];
  function view(a){ var d=(ANG[a]-toView+360)%360; return {0:'S',90:'W',180:'N',270:'E'}[d]; }
  var vec={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]};
  var s="<svg viewBox='0 0 100 62' xmlns='http://www.w3.org/2000/svg'><rect x='3' y='3' width='94' height='56' rx='4' fill='#fff' stroke='#1A1A1A' stroke-width='3'/>";
  (o.arms||['N','E','S','W']).forEach(function(a){ var v=vec[view(a)]; var mn=o.main.indexOf(a)>=0; s+="<path d='M50 31L"+(50+v[0]*38)+" "+(31+v[1]*22)+"' stroke='#1A1A1A' stroke-width='"+(mn?13:5)+"' stroke-linecap='butt'/>"; });
  return s+"</svg>";
}

/* ---------- CROSS / T ---------- */
function renderCross(sc, ctx){
  var arms=sc.arms||['N','E','S','W'];
  var LNS=sc.lanesNS||sc.lanes||1, LEW=sc.lanesEW||sc.lanes||1, hNS=LNS*LW, hEW=LEW*LW;
  var has=function(a){return arms.indexOf(a)>=0;};
  function own(a){ return (a==='N'||a==='S')?hNS:hEW; }
  function crs(a){ return (a==='N'||a==='S')?hEW:hNS; }
  function nl(a){ return (a==='N'||a==='S')?LNS:LEW; }
  var surf=sc.surface||{};
  var s='<rect width="240" height="240" fill="'+COL.grass+'"/>';
  var walks=!!sc.sidewalks||sc.area==='town';
  if(walks){
    if(has('N')||has('S')) s+='<rect x="'+(C-hNS-9)+'" y="'+(has('N')?0:C-hEW-9)+'" width="'+(2*hNS+18)+'" height="'+((has('N')?C:hEW+9)+(has('S')?C:hEW+9))+'" fill="'+COL.walk+'"/>';
    if(has('E')||has('W')) s+='<rect x="'+(has('W')?0:C-hNS-9)+'" y="'+(C-hEW-9)+'" width="'+((has('W')?C:hNS+9)+(has('E')?C:hNS+9))+'" height="'+(2*hEW+18)+'" fill="'+COL.walk+'"/>';
  }
  /* decor in the four corners */
  if(sc.area){ var m=walks?10:3; s+=decor(sc.area, [[0,0,C-hNS-m,C-hEW-m],[C+hNS+m,0,W,C-hEW-m],[0,C+hEW+m,C-hNS-m,W],[C+hNS+m,C+hEW+m,W,W]]); }
  /* arms */
  arms.forEach(function(a){
    var col=surf[a]==='dirt'?COL.dirt:COL.asph;
    if(a==='N') s+='<rect x="'+(C-hNS)+'" y="0" width="'+(2*hNS)+'" height="'+(C-hEW+1)+'" fill="'+col+'"/>';
    if(a==='S') s+='<rect x="'+(C-hNS)+'" y="'+(C+hEW-1)+'" width="'+(2*hNS)+'" height="'+(W-C-hEW+1)+'" fill="'+col+'"/>';
    if(a==='W') s+='<rect x="0" y="'+(C-hEW)+'" width="'+(C-hNS+1)+'" height="'+(2*hEW)+'" fill="'+col+'"/>';
    if(a==='E') s+='<rect x="'+(C+hNS-1)+'" y="'+(C-hEW)+'" width="'+(W-C-hNS+1)+'" height="'+(2*hEW)+'" fill="'+col+'"/>';
  });
  s+='<rect x="'+(C-hNS)+'" y="'+(C-hEW)+'" width="'+(2*hNS)+'" height="'+(2*hEW)+'" fill="'+COL.asph+'"/>';
  var r=9, bg=walks?COL.walk:COL.grass;
  [['N','W',-1,-1],['N','E',1,-1],['S','W',-1,1],['S','E',1,1]].forEach(function(k){
    if(!has(k[0])||!has(k[1])) return; var cx=C+k[2]*hNS, cy=C+k[3]*hEW;
    var fill=(surf[k[0]]==='dirt'||surf[k[1]]==='dirt')?COL.dirt:COL.asph;
    s+='<rect x="'+(k[2]>0?cx:cx-r)+'" y="'+(k[3]>0?cy:cy-r)+'" width="'+r+'" height="'+r+'" fill="'+fill+'"/><circle cx="'+(cx+k[2]*r)+'" cy="'+(cy+k[3]*r)+'" r="'+r+'" fill="'+bg+'"/>';
  });
  if(sc.tram==='NS'||sc.tram===true) s+=rails(C-hNS,has('N')?0:C-hEW,C+hNS,has('S')?W:C+hEW,'v');
  if(sc.tram==='EW') s+=rails(has('W')?0:C-hNS,C-hEW,has('E')?W:C+hNS,C+hEW,'h');
  var cw=sc.crosswalks||[], lights=sc.lights||{}, signs=sc.signs||{}, yl=sc.yieldlines||[];
  function stopYof(a){ return C+crs(a)+(cw.indexOf(a)>=0?19:4); }
  arms.forEach(function(a){
    if(surf[a]==='dirt') return;
    var o=own(a), edge=C+crs(a), cwk=cw.indexOf(a)>=0, stopY=stopYof(a), m='';
    var center=(sc.centerByArm&&sc.centerByArm[a])||sc.center||'dashed', st0=edge+(cwk?16:0);
    if(center==='solid') m+=lineSeg([C,st0],[C,W+20],'solid');
    else if(center==='double') m+=lineSeg([C-2,st0],[C-2,W+20],'solid')+lineSeg([C+2,st0],[C+2,W+20],'solid');
    else if(center==='dashed') m+=lineSeg([C,st0+6],[C,W+20],'dashed');
    for(var k=1;k<nl(a);k++){ m+=lineSeg([C+k*LW,st0+8],[C+k*LW,W+20],'dashed')+lineSeg([C-k*LW,st0+8],[C-k*LW,W+20],'dashed'); }
    if(cwk){ for(var zx=C-o+2; zx<C+o-1; zx+=6) m+='<rect x="'+zx+'" y="'+(edge+3)+'" width="3.4" height="12" fill="#fff"/>'; }
    var wantStop = sc.stoplines===true || (Array.isArray(sc.stoplines)&&sc.stoplines.indexOf(a)>=0) || (sc.stoplines==null && lights[a]);
    if(wantStop) m+='<rect x="'+C+'" y="'+(stopY-1)+'" width="'+o+'" height="2.4" fill="#fff"/>';
    if(yl.indexOf(a)>=0) m+=yieldRow(C, C+o, stopY);
    if(sc.laneArrows&&sc.laneArrows[a]){ sc.laneArrows[a].forEach(function(dirs,i){ m+=laneArrow(C+o-8-16*i, stopY+31, dirs); }); }
    s+='<g transform="rotate('+ANG[a]+' 120 120)">'+m+'</g>';
  });
  (sc.peds||[]).forEach(function(p){
    var a=p.arm||'S', ang=ANG[a], o=own(a), edge=C+crs(a); var t=p.pos==null?0.5:p.pos;
    var pt=rot([C-o+t*2*o, edge+9],ang); var d={l2r:90,r2l:270}[p.dir||'l2r']; var h=(d+ang)%360;
    s+=person(pt[0],pt[1],{0:'up',90:'right',180:'down',270:'left'}[h]||'right',p.color);
  });
  (sc.dims||[]).forEach(function(d){ var a=d.arm||'S', o=own(a), e=C+crs(a); var p1=rot([C+o+6, e+(d.from||0)],ANG[a]), p2=rot([C+o+6, e+(d.to||40)],ANG[a]); s+='<path d="M'+f(p1[0])+' '+f(p1[1])+'L'+f(p2[0])+' '+f(p2[1])+'" stroke="#1B1F23" stroke-width="1" marker-start="url(#'+marker('#1B1F23',ctx)+')" marker-end="url(#'+marker('#1B1F23',ctx)+')"/>'+label((p1[0]+p2[0])/2+8,(p1[1]+p2[1])/2+3,d.label,7.5,'start'); });
  var arrows='', vehs='';
  function turnCmds(a, xl, sy, turn, toLane, atIn){
    var o=own(a), cr=crs(a), dest, cmds, ext;
    if(turn==='straight'){ cmds=[['M',[xl,sy]],['L',[xl,C-cr-26]]]; ext=[xl,-60]; }
    else if(turn==='right'){ var k=toLane||1, yr=C+cr-8-16*(k-1); cmds=[['M',[xl,sy]],['Q',[xl,yr],[C+o+26,yr]]]; ext=[W+60,yr]; }
    else if(turn==='left'){ var dl=(a==='N'||a==='S')?LEW:LNS; var k2=toLane||dl, yl2=C-cr+8+16*(k2-1); cmds=[['M',[xl,sy]],['Q',[xl,yl2],[C-o-26,yl2]]]; ext=[-60,yl2]; }
    else if(turn==='u'){ var k3=toLane||nl(a), xu=C-o+8+16*(k3-1); cmds=[['M',[xl,sy]],['C',[xl,C-cr+2],[xu,C-cr+2],[xu,C+cr+26]]]; ext=[xu,W+60]; }
    return cmds?{cmds:cmds, ext:ext}:null;
  }
  (sc.cars||[]).forEach(function(v){
    var a=v.arm||'S', ang=ANG[a], o=own(a), lane=v.lane||1, xl=C+o-8-16*(lane-1), dm=dims(v.kind);
    if(v.kind==='tram') xl=C+8;
    var stopY=stopYof(a), at=v.at||'stop', pos, head=0;
    var extra = v.dist!=null ? v.dist : ({stop:0,near:38,far:76}[at]||0);
    if(at==='in'){ pos=[xl, C+crs(a)/2+2]; if(v.turn==='left'||v.turn==='u'){ pos=[xl-3, C+3]; head=-12; } if(v.turn==='right'){ pos=[xl+2, C+crs(a)-6]; head=18; } }
    else if(at==='exit'){ var kx=v.lane||1; pos=[C-o+8+16*(kx-1), C+crs(a)+(cw.indexOf(a)>=0?20:6)+dm[1]+10+(v.dist||0)]; head=180; }
    else pos=[xl, stopY+dm[0]+2+extra];
    var mp=null;
    if(v.turn && at!=='exit'){
      var sy = at==='in' ? pos[1]-6 : pos[1]-dm[0]-1;
      var tc=turnCmds(a, xl, sy, v.turn, v.toLane, at==='in');
      if(tc){ var rc=rotCmds(tc.cmds,ang); arrows+=arrowPath(pathStr(rc), arrowColor(v), ctx); mp=motion(rc, rot(pos,ang), rot(tc.ext,ang), ctx); }
    } else if(at==='exit'){ mp=motion([['M',rot([pos[0],pos[1]+10],ang)]], rot(pos,ang), rot([pos[0],W+60],ang), ctx); }
    (v.paths||[]).forEach(function(pth){ var sy2=pos[1]-dm[0]-1; var tc2=turnCmds(a, xl, sy2, pth.turn, pth.toLane); if(tc2){ var rc2=rotCmds(tc2.cmds,ang); arrows+=trajPath(pathStr(rc2), pth.label, lastPt(rc2), ctx); } });
    var p=rot(pos,ang); vehs+=vehicle(v,p[0],p[1],(ang+head)%360, ctx, mp);
  });
  var icons='';
  arms.forEach(function(a){
    var ang=ANG[a], o=own(a), base=C+crs(a)+(cw.indexOf(a)>=0?20:6), off=o+13, used=0;
    if(lights[a]){ var p=rot([C+off, base+14],ang); icons+=smallLight(lights[a],p[0],p[1]); used=30; }
    if(signs[a]){ var codes=(Array.isArray(signs[a])?signs[a]:[signs[a]]).map(function(c){return (c==='7.13'&&sc.main)?{plate:'main',main:sc.main,from:a,arms:arms}:c;}); var p2=rot([C+off, base+6+used+12],ang);
      var tot=codes.reduce(function(t,c){ return t+(isPlateCode(c)?21*0.64:21)+2; },0);
      var ytop = (a==='N'||a==='E') ? p2[1]+10-tot-6 : p2[1]-12;
      icons+=signStack(codes, p2[0], ytop, ctx, 21); }
  });
  var extra2='';
  if(sc.cop) extra2+=cop(sc.cop);
  (sc.obstacles||[]).forEach(function(ob){ var a=ob.arm||'S'; var p=rot([C+own(a)-8-16*((ob.lane||1)-1), C+crs(a)+(ob.dist||40)],ANG[a]); extra2+=obstacle(p[0],p[1]); });
  (sc.labels||[]).forEach(function(l){ extra2+=label(l.x*W, l.y*W, l.text, l.size); });
  return s+arrows+vehs+icons+extra2+overlays(sc);
}
function overlays(sc){ var s=''; if(sc.fog) s+='<rect width="240" height="240" fill="#E9EEF2" opacity="'+(sc.fog===true?0.55:sc.fog)+'"/>'; if(sc.night) s+='<rect width="240" height="240" fill="#0B1530" opacity=".42" pointer-events="none"/>'; return s; }

/* ---------- ROUNDABOUT ---------- */
function renderRound(sc, ctx){
  var arms=sc.arms||['N','E','S','W'], R=50, I=24, RR=37, s='<rect width="240" height="240" fill="'+COL.grass+'"/>';
  if(sc.area) s+=decor(sc.area, [[0,0,86,86],[154,0,240,86],[0,154,86,240],[154,154,240,240]]);
  arms.forEach(function(a){ s+='<g transform="rotate('+ANG[a]+' 120 120)"><rect x="104" y="140" width="32" height="110" fill="'+COL.asph+'"/>'+lineSeg([C,C+R+6],[C,W+10],'dashed')+'</g>'; });
  s+='<circle cx="120" cy="120" r="'+R+'" fill="'+COL.asph+'"/><circle cx="120" cy="120" r="'+I+'" fill="'+COL.grass2+'" stroke="'+COL.curb+'" stroke-width="2"/>';
  if(sc.area==='rural'||sc.area==='town') s+=tree(120,120,9);
  var arrows='', vehs='', icons='', q=Math.sqrt(RR*RR-64);
  var exitPt={right:[C+q,128,[W+60,128]], straight:[128,C-q,[128,-60]], left:[C-q,112,[-60,112]], u:[112,C+q,[112,W+60]]};
  (sc.cars||[]).forEach(function(v){
    if(v.ring!=null){ var ang=v.ring*Math.PI/180; var x=C+RR*Math.sin(ang), y=C-RR*Math.cos(ang), rmp=null;
      if(v.exit && ANG[v.exit]!=null){ var ea=(192.5+ANG[v.exit])%360, delta=((v.ring-ea)%360+360)%360, lg=delta>180?1:0; var er=ea*Math.PI/180, ex=C+RR*Math.sin(er), ey=C-RR*Math.cos(er); var dv={S:[0,1],W:[-1,0],N:[0,-1],E:[1,0]}[v.exit];
        var st=[C+RR*Math.sin(ang), C-RR*Math.cos(ang)]; var dA='M'+f(st[0])+' '+f(st[1])+' A'+RR+' '+RR+' 0 '+lg+' 0 '+f(ex)+' '+f(ey)+' L'+f(ex+dv[0]*18)+' '+f(ey+dv[1]*18);
        arrows+=arrowPath(dA, arrowColor(v), ctx); var mid='mp'+ctx.id+'_'+(++ctx.mseq); ctx.mpaths+='<path id="'+mid+'" class="mpath" d="M'+f(st[0])+' '+f(st[1])+' A'+RR+' '+RR+' 0 '+lg+' 0 '+f(ex)+' '+f(ey)+' L'+f(ex+dv[0]*170)+' '+f(ey+dv[1]*170)+'" fill="none" stroke="none"/>'; rmp=mid; }
      vehs+=vehicle(v,x,y,(v.ring-90+360)%360,ctx,rmp); return; }
    var a=ANG[v.arm||'S'], dm=dims(v.kind), at=v.at||'stop';
    var y0 = C+Math.sqrt(R*R-64)+dm[0]+4 + (v.dist!=null?v.dist:({stop:0,near:30,far:60}[at]||0));
    var pos=[128,y0], mp=null;
    if(v.turn&&exitPt[v.turn]){ var e=exitPt[v.turn]; var large=(v.turn==='left'||v.turn==='u')?1:0;
      var p0=rot([128,y0-dm[0]-1],a), p1=rot([128,C+q],a), p2=rot([e[0],e[1]],a), p3=rot([e[0]+(e[2][0]-e[0])*0.12,e[1]+(e[2][1]-e[1])*0.12],a);
      var d='M'+f(p0[0])+' '+f(p0[1])+' L'+f(p1[0])+' '+f(p1[1])+' A'+RR+' '+RR+' 0 '+large+' 0 '+f(p2[0])+' '+f(p2[1])+' L'+f(p3[0])+' '+f(p3[1]);
      arrows+=arrowPath(d, arrowColor(v), ctx);
      var pc=rot(pos,a), pe=rot(e[2],a), mid='mp'+ctx.id+'_'+(++ctx.mseq);
      ctx.mpaths+='<path id="'+mid+'" class="mpath" d="M'+f(pc[0])+' '+f(pc[1])+' L'+f(p1[0])+' '+f(p1[1])+' A'+RR+' '+RR+' 0 '+large+' 0 '+f(p2[0])+' '+f(p2[1])+' L'+f(pe[0])+' '+f(pe[1])+'" fill="none" stroke="none"/>'; mp=mid; }
    var p=rot(pos,a); vehs+=vehicle(v,p[0],p[1],a,ctx,mp);
  });
  var signs=sc.signs||{};
  arms.forEach(function(a){ if(!signs[a]) return; var p=rot([C+31, C+R+14],ANG[a]); icons+=signStack(signs[a], p[0], p[1]-6, ctx, 21); });
  (sc.labels||[]).forEach(function(l){ icons+=label(l.x*W, l.y*W, l.text, l.size); });
  return s+arrows+vehs+icons+overlays(sc);
}

/* ---------- ROAD ---------- */
function renderRoad(sc, ctx){
  var U=sc.up==null?1:sc.up, Dn=sc.down==null?1:sc.down, lw=18, oneway=Dn===0;
  var x0 = C - (U-Dn)*lw/2, left=x0-Dn*lw, right=x0+U*lw;
  function Y(t){ return 232 - t*224; }
  function laneX(l){ if(!l) l='u1'; var d=l[0], k=parseInt(l.slice(1),10)||1; return d==='d' ? left+lw/2+lw*(k-1) : right-lw/2-lw*(k-1); }
  var dirt=sc.surface==='dirt';
  var s='<rect width="240" height="240" fill="'+COL.grass+'"/>';
  var edge=sc.edge||(dirt?'none':'shoulder'), sw=edge==='sidewalk'?14:(edge==='shoulder'?8:0);
  if(sc.area==='town'&&edge!=='sidewalk'){ edge='sidewalk'; sw=14; }
  if(sc.area){ s+=decor(sc.area, [[0,0,left-sw-4,W],[right+sw+4,0,W,W]].map(function(r){ return r; }).reduce(function(acc,r){ for(var yy=r[1]; yy<r[3]; yy+=60) acc.push([r[0],yy+4,r[2],Math.min(yy+56,r[3])]); return acc; },[])); }
  if(edge==='sidewalk') s+='<rect x="'+(left-sw)+'" y="0" width="'+(right-left+2*sw)+'" height="240" fill="'+COL.walk+'"/>';
  if(edge==='shoulder') s+='<rect x="'+(left-sw)+'" y="0" width="'+(right-left+2*sw)+'" height="240" fill="#B9AE98"/>';
  (sc.side||[]).forEach(function(r){
    var yy=Y(r.y), yard=r.kind==='yard', w=yard?16:32; var xs=r.side==='left'?0:right, xe=r.side==='left'?left:W;
    var col= yard?'#8A9096':(r.surface==='dirt'?COL.dirt:COL.asph);
    s+='<rect x="'+xs+'" y="'+f(yy-w/2)+'" width="'+(xe-xs)+'" height="'+w+'" fill="'+col+'"/>';
    if(!yard && r.surface!=='dirt') s+=lineSeg([r.side==='left'?0:right+sw+2, yy],[r.side==='left'?left-sw-2:W, yy],'dashed');
    if(yard){ var gx=r.side==='left'?left-sw-4:right+sw+4; s+='<path d="M'+f(gx)+' '+f(yy-w/2)+'V'+f(yy+w/2)+'" stroke="#6B5A3C" stroke-width="2" stroke-dasharray="2 2"/>'+label(r.side==='left'?20:W-20, yy-w/2-3, r.text||'двор', 7); }
  });
  s+='<rect x="'+left+'" y="0" width="'+(right-left)+'" height="240" fill="'+(dirt?COL.dirt:COL.asph)+'"/>';
  (sc.side||[]).forEach(function(r){ if(r.kind==='yard') return; var yy=Y(r.y); s+='<rect x="'+(r.side==='left'?left-sw-1:right-1)+'" y="'+f(yy-16)+'" width="'+(sw+2)+'" height="32" fill="'+(r.surface==='dirt'?COL.dirt:COL.asph)+'"/>'; });
  if(sc.strip) s+='<rect x="'+f(x0-6)+'" y="0" width="12" height="240" fill="'+COL.strip+'" stroke="'+COL.curb+'" stroke-width="1"/>';
  if(!dirt){
    var div=sc.divider==null?(oneway?'none':'dashed'):sc.divider;
    var segs = Array.isArray(div)?div:[{from:0,to:1,type:div}];
    if(!sc.strip) segs.forEach(function(g){
      var y1=Y(g.to==null?1:g.to)-(g.to>=1?10:0), y2=Y(g.from||0)+(g.from?0:10), t=g.type;
      if(t==='dashed'||t==='solid'||t==='warn') s+=lineSeg([x0,y1],[x0,y2],t);
      else if(t==='double') s+=lineSeg([x0-2,y1],[x0-2,y2],'solid')+lineSeg([x0+2,y1],[x0+2,y2],'solid');
      else if(t==='1.11u') s+=lineSeg([x0-2,y1],[x0-2,y2],'solid')+lineSeg([x0+2,y1],[x0+2,y2],'dashed');
      else if(t==='1.11d') s+=lineSeg([x0-2,y1],[x0-2,y2],'dashed')+lineSeg([x0+2,y1],[x0+2,y2],'solid');
      else if(t==='yellow') s+=lineSeg([x0,y1],[x0,y2],'solid',COL.yel);
    });
    var ll=sc.laneLines||'dashed', bl=sc.busLane||null;
    for(var k=1;k<U;k++){ var bx=right-lw*k; var isBus = bl && bl[0]==='u' && (parseInt(bl.slice(1))===k); s+=lineSeg([bx,-10],[bx,250], isBus?(sc.busLine||'solid'):ll); }
    for(var k2=1;k2<Dn;k2++){ var dx=left+lw*k2; var isBusD = bl && bl[0]==='d' && (parseInt(bl.slice(1))===k2); s+=lineSeg([dx,-10],[dx,250], isBusD?(sc.busLine||'solid'):ll); }
    if(bl){ var bxc=laneX(bl); [0.15,0.55,0.9].forEach(function(t){ s+='<text x="'+f(bxc)+'" y="'+f(Y(t)+5)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff"'+(bl[0]==='d'?' transform="rotate(180 '+f(bxc)+' '+f(Y(t))+')"':'')+'>А</text>'; }); }
    if(sc.edgeLine) s+=lineSeg([left+1.5,-10],[left+1.5,250],'solid')+lineSeg([right-1.5,-10],[right-1.5,250],'solid');
  }
  if(sc.tram && !dirt){ var tl2 = sc.tram===true ? (Dn? ['u'+U,'d'+Dn] : ['u1']) : (Array.isArray(sc.tram)?sc.tram:[sc.tram]); tl2.forEach(function(l){ var xr=laneX(l); s+=rails(xr-9,0,xr+9,240,'v'); }); }
  if(sc.rail){
    var ry=Y(sc.rail.y==null?0.55:sc.rail.y), tracks=sc.rail.tracks||1;
    for(var t=0;t<tracks;t++){ var cy=ry-t*22; for(var xx=0;xx<W;xx+=6) s+='<rect x="'+xx+'" y="'+(cy-8)+'" width="2.4" height="16" fill="'+COL.sleeper+'"/>'; s+='<path d="M0 '+(cy-4.5)+'H240M0 '+(cy+4.5)+'H240" stroke="'+COL.rail+'" stroke-width="1.8"/>'; }
    var top=ry-(tracks-1)*22-16, bot=ry+16;
    if(sc.rail.barrier && sc.rail.barrier!=='none'){
      var down=sc.rail.barrier==='down';
      s+='<rect x="'+(right+sw+2)+'" y="'+(bot+4)+'" width="5" height="5" fill="#1B1F23"/>'+(down?'<path d="M'+(right+sw+4)+' '+(bot+6.5)+'H'+(x0-1)+'" stroke="#D62D20" stroke-width="3.2"/><path d="M'+(right+sw+4)+' '+(bot+6.5)+'H'+(x0-1)+'" stroke="#fff" stroke-width="3.2" stroke-dasharray="5 5"/>':'<path d="M'+(right+sw+4.5)+' '+(bot+6.5)+'V'+(bot+18)+'" stroke="#D62D20" stroke-width="3"/>');
      if(!oneway) s+='<rect x="'+(left-sw-7)+'" y="'+(top-9)+'" width="5" height="5" fill="#1B1F23"/>'+(down?'<path d="M'+(left-sw-4.5)+' '+(top-6.5)+'H'+(x0+1)+'" stroke="#D62D20" stroke-width="3.2"/><path d="M'+(left-sw-4.5)+' '+(top-6.5)+'H'+(x0+1)+'" stroke="#fff" stroke-width="3.2" stroke-dasharray="5 5"/>':'');
    }
    if(sc.rail.lights){ var lx=right+sw+26, lyy=bot+9, st=sc.rail.lights; s+='<rect x="'+(lx-9)+'" y="'+(lyy-5.5)+'" width="18" height="'+(st==='white'||st==='off'?18:11)+'" rx="2" fill="#1C1F22"/>'+lamp(lx-4.5,lyy,3,'red',st==='flash'||st==='red',st==='flash')+lamp(lx+4.5,lyy,3,'red',st==='flash'||st==='red',st==='flash')+(st==='white'||st==='off'?lamp(lx,lyy+7,2.6,'white',st==='white',st==='white'):''); }
    if(sc.rail.stopline!==false) s+='<rect x="'+x0+'" y="'+f(bot+(sc.rail.barrier&&sc.rail.barrier!=='none'?16:10))+'" width="'+(right-x0)+'" height="2.4" fill="#fff"/>';
    if(sc.rail.train){ var tr=sc.rail.train, near=tr.dist!=='far', fromL=tr.from==='left'; var tcy=ry-((tr.track||1)-1)*22, tl=150;
      var tx0 = fromL ? (near? left-40-tl : -tl-20) : (near? right+40 : W+20);
      var nose = fromL ? tx0+tl : tx0;
      s+='<rect x="'+f(tx0)+'" y="'+(tcy-7)+'" width="'+tl+'" height="14" rx="3" fill="#2E6E4E" stroke="#1B1F23" stroke-width=".8"/><path d="M'+f(fromL?nose-3:nose+3)+' '+(tcy-5)+'v10" stroke="#FFE9A8" stroke-width="2.2"/>';
      if(!near){ s+=label(fromL?16:W-16, tcy-11, fromL?'поезд →':'← поезд', 7.5); } }
  }
  (sc.marks||[]).forEach(function(m){
    if(m.type==='crosswalk'){ var yy=Y(m.y); for(var zx=left+2; zx<right-1; zx+=6) s+='<rect x="'+zx+'" y="'+f(yy-7)+'" width="3.4" height="14" fill="#fff"/>'; }
    else if(m.type==='stopline'){ var yy2=Y(m.y); s+='<rect x="'+(m.all?left:x0)+'" y="'+f(yy2-1.2)+'" width="'+(m.all?right-left:right-x0)+'" height="2.4" fill="#fff"/>'; }
    else if(m.type==='yield'){ s+=yieldRow(x0,right,Y(m.y)); }
    else if(m.type==='yellow-edge'){ var xe=m.side==='left'?left+2:right-2; s+=lineSeg([xe,Y(m.to==null?1:m.to)],[xe,Y(m.from||0)], m.dashed?'dashed':'solid', COL.yel); }
    else if(m.type==='zigzag'){ var xz=m.side==='left'?left+3:right-3, y1=Y(m.to), y2=Y(m.from), d='M'+xz+' '+f(y2), o=m.side==='left'?5:-5, i=0; for(var yv=y2; yv>y1; yv-=6){ d+='L'+f(xz+(i%2?0:o))+' '+f(yv-6); i++; } s+='<path d="'+d+'" fill="none" stroke="'+COL.yel+'" stroke-width="1.6"/>'; }
    else if(m.type==='arrows'){ s+=laneArrow(laneX(m.lane), Y(m.y), m.dirs, (m.lane||'u1')[0]==='d'?180:0); }
    else if(m.type==='hatch'){ var hy1=Y(m.to), hy2=Y(m.from); s+='<path d="M'+(x0-4)+' '+f(hy1)+'V'+f(hy2)+'M'+(x0+4)+' '+f(hy1)+'V'+f(hy2)+'" stroke="#fff" stroke-width="1.6"/>'; for(var hy=hy2; hy>hy1+4; hy-=8) s+='<path d="M'+(x0-4)+' '+f(hy)+'L'+(x0+4)+' '+f(hy-6)+'" stroke="#fff" stroke-width="1.6"/>'; }
  });
  if(sc.busstop){ (Array.isArray(sc.busstop)?sc.busstop:[sc.busstop]).forEach(function(b){ var yy=Y(b.y); var xb=b.side==='left'?left-sw-8:right+sw+8; s+='<rect x="'+(xb-4)+'" y="'+f(yy-12)+'" width="8" height="24" rx="1.5" fill="#2F6FD6" stroke="#1B1F23" stroke-width=".6"/>'+label(xb+(b.side==='left'?-2:2), yy+22, 'остановка', 6.5); }); }
  (sc.dims||[]).forEach(function(d){ var xd=d.side==='left'?left-sw-8:right+sw+8, y1=Y(d.to), y2=Y(d.from); var mk=marker('#1B1F23',ctx); s+='<path d="M'+xd+' '+f(y1+3)+'V'+f(y2-3)+'" stroke="#1B1F23" stroke-width="1" marker-start="url(#'+mk+')" marker-end="url(#'+mk+')"/>'+label(xd+(d.side==='left'?-4:4), (y1+y2)/2+3, d.label, 7.5, d.side==='left'?'end':'start'); });
  var vehs='', arrows='';
  (sc.parked||[]).forEach(function(p){ var xp=p.side==='left'?(p.onWalk?left-sw/2:left+7):(p.onWalk?right+sw/2:right-7); vehs+=vehicle(p, xp, Y(p.y), p.side==='left'?180:0, ctx, null); });
  (sc.peds||[]).forEach(function(p){ var xp=left+(p.x==null?0.5:p.x)*(right-left); if(p.walk==='left') xp=left-sw/2; if(p.walk==='right') xp=right+sw/2; vehs+=person(xp, Y(p.y), p.dir||'right', p.color); });
  (sc.obstacles||[]).forEach(function(o){ vehs+=obstacle(laneX(o.lane), Y(o.y)); });
  function arrowCmds(v, x, y, dm, down, a){
    var fy=down?y+dm[0]+1:y-dm[0]-1, fx=x, dir=down?1:-1, cmds=null, ext=null;
    if(v.side!=null){
      var rr=(sc.side||[])[v.side]; var inb2=rr&&rr.side==='left'; var sx=inb2?x+dm[0]+1:x-dm[0]-1;
      if(a==='right'){ var tx=inb2?laneX('d1'):laneX('u1'); cmds=[['M',[sx,y]],['Q',[tx,y],[tx,inb2?y+40:y-40]]]; ext=[tx,inb2?W+60:-60]; }
      else if(a==='left'){ var tx2=inb2?laneX('u1'):laneX('d1'); cmds=[['M',[sx,y]],['Q',[tx2,y],[tx2,inb2?y-40:y+40]]]; ext=[tx2,inb2?-60:W+60]; }
      else if(a==='straight'){ cmds=[['M',[sx,y]],['L',[inb2?right+30:left-30,y]]]; ext=[inb2?W+60:-60,y]; }
      return cmds?{cmds:cmds,ext:ext}:null;
    }
    var k=parseInt((v.lane||'u1').slice(1))||1;
    if(a==='straight'){ cmds=[['M',[fx,fy]],['L',[fx,fy+dir*60]]]; ext=[fx,down?W+60:-60]; }
    else if(a==='overtake'||a==='bypass'){ var tl = down? (k<Dn?'d'+(k+1):'u1') : (k<U?'u'+(k+1):'d1'); var xt=laneX(tl), L2=a==='bypass'?70:110;
      cmds=[['M',[fx,fy]],['C',[fx,fy+dir*18],[xt,fy+dir*14],[xt,fy+dir*34]],['L',[xt,fy+dir*(L2-34)]],['C',[xt,fy+dir*(L2-14)],[fx,fy+dir*(L2-18)],[fx,fy+dir*L2]]]; ext=[fx,down?W+60:-60]; }
    else if(a==='change-left'||a==='change-right'){ var tlane; if(!down){ tlane = a==='change-left' ? (k<U?'u'+(k+1):'d1') : 'u'+Math.max(1,k-1); } else { tlane = a==='change-left' ? (k<Dn?'d'+(k+1):'u1') : 'd'+Math.max(1,k-1); } var xt2=laneX(tlane); cmds=[['M',[fx,fy]],['C',[fx,fy+dir*22],[xt2,fy+dir*18],[xt2,fy+dir*44]],['L',[xt2,fy+dir*56]]]; ext=[xt2,down?W+60:-60]; }
    else if(a==='stop-right'||a==='park-right'){ var xe2 = down? left+7 : right-7; if(a==='park-right'&&sw) xe2 = down? left-sw/2 : right+sw/2; cmds=[['M',[fx,fy]],['C',[fx,fy+dir*20],[xe2,fy+dir*16],[xe2,fy+dir*40]]]; ext=[xe2,fy+dir*52]; }
    else if(a==='stop-left'){ var xe3 = down? right-7 : left+7; cmds=[['M',[fx,fy]],['C',[fx,fy+dir*20],[xe3,fy+dir*16],[xe3,fy+dir*44]]]; ext=[xe3,fy+dir*56]; }
    else if(a==='u'){ var xt4=laneX(down?'u1':'d1'); cmds=[['M',[fx,fy]],['C',[fx,fy+dir*34],[xt4,fy+dir*34],[xt4,fy+dir*2]],['L',[xt4,fy+dir*-20]]]; ext=[xt4,down?-60:W+60]; }
    else if(a==='reverse'){ var by=down?y-dm[1]-1:y+dm[1]+1; cmds=[['M',[x,by]],['L',[x,by-dir*40]]]; ext=null; }
    else if(a==='left'||a==='right'){
      var sr=null; (sc.side||[]).forEach(function(r){ var wantSide = down ? (a==='left'?'right':'left') : a; if(r.side===wantSide && (down? Y(r.y)>y : Y(r.y)<y) && !sr) sr=r; });
      if(sr){ var ys=Y(sr.y), yard2=sr.kind==='yard', off2=yard2?0:8, goRight=(sr.side==='right'); var ty = goRight ? ys+off2 : ys-off2; if(down){ ty = goRight ? ys+off2 : ys-off2; }
        cmds=[['M',[fx,fy]],['Q',[fx,ty],[goRight?right+sw+26:left-sw-26,ty]]]; ext=[goRight?W+60:-60,ty]; }
      else { cmds=[['M',[fx,fy]],['Q',[fx,fy+dir*36],[fx+(a==='right'?1:-1)*(down?-1:1)*36,fy+dir*36]]]; }
    }
    return cmds?{cmds:cmds,ext:ext}:null;
  }
  (sc.cars||[]).forEach(function(v){
    var down=(v.lane||'u1')[0]==='d', x=laneX(v.lane), y=Y(v.y==null?0.2:v.y), dm=dims(v.kind), head=down?180:0;
    if(v.side!=null){ var r=(sc.side||[])[v.side]; if(r){ var yy=Y(r.y), yard=r.kind==='yard'; var inb = r.side==='left'; x = inb ? left-sw-(yard?14:24) : right+sw+(yard?14:24); y = yard?yy:(inb?yy+8:yy-8); head = inb?90:270; } }
    if(v.onShoulder){ x = v.onShoulder==='left'? left-sw/2 : right+sw/2; }
    var mp=null;
    if(v.arrow){ var ac=arrowCmds(v,x,y,dm,down,v.arrow); if(ac){ arrows+=arrowPath(pathStr(ac.cmds), arrowColor(v), ctx); if(ac.ext) mp=motion(ac.cmds,[x,y],ac.ext,ctx); } }
    (v.paths||[]).forEach(function(pth){ var ac2=arrowCmds(v,x,y,dm,down,pth.arrow); if(ac2) arrows+=trajPath(pathStr(ac2.cmds), pth.label, lastPt(ac2.cmds), ctx); });
    vehs+=vehicle(v,x,y,head,ctx,mp);
  });
  var icons='';
  (sc.signs||[]).forEach(function(g){ var xs=g.side==='left'?left-sw-13:right+sw+13; if(g.over) xs=laneX(g.over); icons+=signStack(g.codes||g.code, xs, Y(g.y)-10, ctx, g.size||21); });
  (sc.lights||[]).forEach(function(l){ var xs=l.side==='left'?left-sw-9:right+sw+9; icons+=smallLight(l.state, xs, Y(l.y)); });
  (sc.labels||[]).forEach(function(l){ icons+=label(l.x*W, l.y*W, l.text, l.size); });
  if(sc.cop) icons+=cop({x:sc.cop.x!=null?sc.cop.x*W:x0, y:Y(sc.cop.y==null?0.6:sc.cop.y), face:sc.cop.face, pose:sc.cop.pose});
  return s+arrows+vehs+icons+overlays(sc);
}

/* ---------- SIGNAL ---------- */
function pedLamp(cx,cy,r,color,on,flash){
  var s=lamp(cx,cy,r,color,on,flash), ink=on?'#15181B':({red:'#6A3431',green:'#2C5A40'}[color]);
  if(color==='red') s+='<g transform="translate('+f(cx)+' '+f(cy)+') scale('+f(r/20)+')" fill="'+ink+'"><circle cx="0" cy="-11" r="3.4"/><rect x="-4" y="-7" width="8" height="10" rx="2"/><rect x="-4" y="3" width="3" height="10"/><rect x="1" y="3" width="3" height="10"/></g>';
  else s+='<g transform="translate('+f(cx)+' '+f(cy)+') scale('+f(r/20)+')" fill="'+ink+'"><circle cx="1" cy="-11" r="3.4"/><path d="M-2 -7h6l2 9h-3l-1 -5l-1 6l4 9h-3.5l-3 -7l-3 7h-3.5l4 -9l0 -6l-2 3h-3z"/></g>';
  return s;
}
function renderSignal(sc, ctx){
  var items=sc.items||[], n=items.length, s='<rect width="240" height="240" fill="#E7EBEE"/>', slot=240/Math.max(1,n);
  items.forEach(function(it,i){
    var k=Math.min(1, slot/110), cx=60, kind=it.kind||'car', st=lightState(it);
    s+='<g transform="translate('+f(slot*i+slot/2-60*k)+' '+f(118*(1-k))+') scale('+k.toFixed(3)+')">';
    if(kind==='car'){
      var r=17, h=3*r*2+28, top=118-h/2;
      var narrow=Object.keys(st.arrows).length; if(narrow) cx-= (r+6)*narrow/2;
      s+='<rect x="'+f(cx-r-8)+'" y="'+f(top)+'" width="'+(2*r+16)+'" height="'+f(h)+'" rx="8" fill="#1C1F22"/>';
      ['red','yellow','green'].forEach(function(c,j){ s+=lamp(cx, top+14+r+j*(2*r+8), r, c, st.on.indexOf(c)>=0, st.flash.indexOf(c)>=0, st.shape[c]); });
      var ax=cx+r+12; Object.keys(st.arrows).forEach(function(dir){ var ay=top+14+r+2*(2*r+8); s+='<rect x="'+f(ax-4)+'" y="'+f(ay-r-6)+'" width="'+(2*r+4)+'" height="'+(2*r+12)+'" rx="6" fill="#1C1F22"/>'+lamp(ax+r-2, ay, r-2, 'green', st.arrows[dir]!=='off', st.arrows[dir]==='flash', dir); ax+=2*r+8; });
    } else if(kind==='ped'){
      var pr=20, top2=118-2*pr-14;
      s+='<rect x="'+f(cx-pr-8)+'" y="'+f(top2)+'" width="'+(2*pr+16)+'" height="'+(4*pr+28)+'" rx="8" fill="#1C1F22"/>';
      s+=pedLamp(cx, top2+10+pr, pr, 'red', st.on.indexOf('red')>=0, false)+pedLamp(cx, top2+18+3*pr, pr, 'green', st.on.indexOf('green')>=0, st.flash.indexOf('green')>=0);
    } else if(kind==='rev'){
      var rr=22; s+='<rect x="'+f(cx-rr-8)+'" y="'+f(118-rr-8)+'" width="'+(2*rr+16)+'" height="'+(2*rr+16)+'" rx="8" fill="#1C1F22"/>';
      var sym=it.symbol||'x';
      if(sym==='x') s+='<path d="M'+(cx-13)+' 105L'+(cx+13)+' 131M'+(cx+13)+' 105L'+(cx-13)+' 131" stroke="#FF3B2F" stroke-width="6" stroke-linecap="round"/>';
      else if(sym==='down') s+='<path d="M'+cx+' 101V131M'+(cx-11)+' 121L'+cx+' 134L'+(cx+11)+' 121" stroke="#2BD46E" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      else if(sym==='diag-left'||sym==='diag-right'){ var sg=sym==='diag-left'?-1:1; s+='<path d="M'+(cx-sg*12)+' 105L'+(cx+sg*10)+' 131M'+(cx+sg*10)+' 117V131H'+(cx-sg*4)+'" stroke="#FFC21A" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'; }
    } else if(kind==='rail'){
      var y=108; s+='<rect x="'+f(cx-44)+'" y="'+(y-26)+'" width="88" height="'+(it.white!=null?86:52)+'" rx="8" fill="#1C1F22"/>'+lamp(cx-21,y,15,'red',st.on.indexOf('red')>=0,st.flash.indexOf('red')>=0)+lamp(cx+21,y,15,'red',st.on.indexOf('red')>=0,st.flash.indexOf('red')>=0);
      if(it.white!=null) s+=lamp(cx,y+40,11,'white',!!it.white,!!it.white);
    } else if(kind==='tram'){
      var ty=96, tr=11; s+='<rect x="'+f(cx-42)+'" y="'+(ty-18)+'" width="84" height="76" rx="8" fill="#1C1F22"/>';
      var tp={left:[cx-26,ty],up:[cx,ty],right:[cx+26,ty],base:[cx,ty+34]};
      Object.keys(tp).forEach(function(k){ s+=lamp(tp[k][0],tp[k][1],tr,'white',st.on.indexOf(k)>=0,false); });
    }
    s+='</g>';
    if(it.label) s+=label(slot*i+slot/2, 226, it.label, n>2?8:10);
  });
  (sc.labels||[]).forEach(function(l){ s+=label(l.x*W, l.y*W, l.text, l.size||10); });
  return s;
}

/* ---------- SIGNS group ---------- */
function renderSigns(sc, ctx){
  var groups=sc.items||[], n=groups.length, s='<rect width="240" height="240" fill="#E7EBEE"/>';
  var slot=240/Math.max(1,n), size=Math.min(92, slot-22);
  groups.forEach(function(g,i){
    var codes=Array.isArray(g)?g:[g]; var cx=slot*i+slot/2, hs=codes.map(function(c){ return isPlateCode(c)?size*0.64:size; }), tot=hs.reduce(function(a,b){return a+b+4;},0);
    var y=Math.max(10,112-tot/2); s+='<rect x="'+f(cx-1.8)+'" y="'+f(y+hs[0]/2)+'" width="3.6" height="'+f(240-(y+hs[0]/2))+'" fill="#8E969C"/>';
    codes.forEach(function(c,j){ s+=signIcon(c, cx, y+hs[j]/2, isPlateCode(c)?size*1.05:size, ctx); y+=hs[j]+4; });
  });
  (sc.labels||[]).forEach(function(l){ s+=label(l.x*W, l.y*W, l.text, l.size||10); });
  return s;
}

/* ---------- dynamic signs ---------- */
function dynSign(code, catalog){
  if(typeof code==='object' && code.plate==='main') return mainPlate(code);
  code=String(code);
  var m=code.match(/^([0-9.]+):(.+)$/), base=m?m[1]:code, val=m?m[2]:null;
  if(!val && catalog[base]) return catalog[base];
  var T="<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>";
  var tf=function(t,sz,col,y){ return "<text x='50' y='"+(y||62)+"' text-anchor='middle' font-family='Arial,sans-serif' font-weight='700' font-size='"+sz+"' fill='"+col+"'>"+esc(t)+"</text>"; };
  var fz=function(t){ return t.length<=2?40:(t.length===3?32:24); };
  if(val!=null){
    if(base==='3.24') return T+"<circle cx='50' cy='50' r='44' fill='#fff' stroke='#D52B1E' stroke-width='9'/>"+tf(val,fz(val),'#1A1A1A',64)+"</svg>";
    if(base==='3.25') return T+"<circle cx='50' cy='50' r='46' fill='#fff' stroke='#1A1A1A' stroke-width='2'/>"+tf(val,fz(val),'#9AA0A6',64)+"<path d='M22 78L78 22M28 84L84 28M16 72L72 16' stroke='#1A1A1A' stroke-width='3'/></svg>";
    if(base==='4.7') return T+"<circle cx='50' cy='50' r='46' fill='#1D5BB8'/>"+tf(val,fz(val),'#fff',64)+"</svg>";
    if(base==='4.8') return T+"<circle cx='50' cy='50' r='46' fill='#1D5BB8'/>"+tf(val,fz(val),'#fff',64)+"<path d='M22 78L78 22' stroke='#D52B1E' stroke-width='7'/></svg>";
    if(base==='3.11'||base==='3.12'||base==='3.13'||base==='3.14'||base==='3.15'||base==='3.16'){ return T+"<circle cx='50' cy='50' r='44' fill='#fff' stroke='#D52B1E' stroke-width='9'/>"+tf(val,val.length>4?19:24,'#1A1A1A',58)+(base==='3.13'?"<path d='M50 16l-7 9h14zM50 84l-7-9h14z' fill='#1A1A1A'/>":"")+(base==='3.14'?"<path d='M16 50l9-7v14zM84 50l-9-7v14z' fill='#1A1A1A'/>":"")+(base==='3.12'?"<path d='M30 30h40' stroke='#1A1A1A' stroke-width='4'/><circle cx='30' cy='30' r='6' fill='#1A1A1A'/><circle cx='70' cy='30' r='6' fill='#1A1A1A'/>":"")+(base==='3.15'?"<path d='M24 74h52M24 68v12M76 68v12' stroke='#1A1A1A' stroke-width='3'/>":"")+(base==='3.16'?"<rect x='22' y='24' width='14' height='10' fill='#1A1A1A'/><rect x='64' y='24' width='14' height='10' fill='#1A1A1A'/><path d='M38 29h24' stroke='#1A1A1A' stroke-width='3'/>":"")+"</svg>"; }
    if(base==='1.13'||base==='1.14'){ var up=base==='1.14'; return T+"<path d='M50 8 L95 88 H5 Z' fill='#fff' stroke='#D52B1E' stroke-width='8' stroke-linejoin='round'/><path d='"+(up?"M22 80H80V56Z":"M22 80H80L22 56Z")+"' fill='#1A1A1A'/>"+tf(val,15,'#1A1A1A',52)+"</svg>"; }
    if(base==='5.22'||base==='5.23'||base==='5.24'||base==='5.25'){ var blue=base==='5.24'||base==='5.25', cross=base==='5.23'||base==='5.25'; return "<svg viewBox='0 0 100 50' xmlns='http://www.w3.org/2000/svg'><rect x='2' y='2' width='96' height='46' rx='4' fill='"+(blue?'#1D5BB8':'#fff')+"' stroke='"+(blue?'#fff':'#1A1A1A')+"' stroke-width='3'/><text x='50' y='31' text-anchor='middle' font-family='Arial,sans-serif' font-weight='700' font-size='"+(val.length>9?11:14)+"' fill='"+(blue?'#fff':'#1A1A1A')+"'>"+esc(val.toUpperCase())+"</text>"+(cross?"<path d='M8 44L92 6' stroke='#D52B1E' stroke-width='4'/>":"")+"</svg>"; }
  }
  if(/^p:/.test(code)){ var txt=code.replace(/^p:/,''); return "<svg viewBox='0 0 100 60' xmlns='http://www.w3.org/2000/svg'><rect x='3' y='3' width='94' height='54' rx='4' fill='#fff' stroke='#1A1A1A' stroke-width='3'/><text x='50' y='37' text-anchor='middle' font-family='Arial,sans-serif' font-weight='700' font-size='"+(txt.length>12?10:(txt.length>7?14:20))+"' fill='#1A1A1A'>"+esc(txt)+"</text></svg>"; }
  if(catalog[base]) return catalog[base];
  return T+"<rect x='6' y='6' width='88' height='88' rx='8' fill='#F4D6D6' stroke='#C00' stroke-width='4'/>"+tf(code,18,'#C00',56)+"</svg>";
}
var DYN=['3.24','3.25','4.7','4.8','3.11','3.12','3.13','3.14','3.15','3.16','1.13','1.14','5.22','5.23','5.24','5.25'];
function knownSign(code, catalog){
  if(typeof code==='object') return code.plate==='main';
  code=String(code); if(/^p:.+/.test(code)) return true;
  var m=code.match(/^([0-9.]+):(.+)$/); if(m) return DYN.indexOf(m[1])>=0;
  return !!catalog[code];
}
function signCodes(sc){
  var out=[]; function add(c){ if(c!=null) out.push(c); } function addAll(x){ if(Array.isArray(x)) x.forEach(add); else add(x); }
  if(!sc) return out;
  if(sc.signs){ if(Array.isArray(sc.signs)) sc.signs.forEach(function(g){ addAll(g.codes||g.code); }); else Object.keys(sc.signs).forEach(function(k){ addAll(sc.signs[k]); }); }
  if(sc.type==='signs') (sc.items||[]).forEach(addAll);
  return out.filter(function(c){ return c!=='7.13' || !sc.main; });
}
function caption(sc){
  var me=(sc.cars||[]).filter(function(c){return c.me;})[0];
  if(!me) return '';
  var kind=me.kind||'car';
  var noun={moped:'мопед',car:'автомобиль',taxi:'автомобиль',truck:'грузовой автомобиль',bus:'автобус',moto:'мотоцикл',bike:'велосипед',tram:'трамвай',trolleybus:'троллейбус','car-trailer':'автомобиль с прицепом','truck-trailer':'автопоезд',semi:'седельный тягач','bus-art':'сочлененный автобус',tractor:'трактор',scooter:'электросамокат'}[kind]||'автомобиль';
  var col=me.color||'red'; var adj=RUCOL[col]||'';
  var fem = ['moto','bike','scooter'].indexOf(kind)>=0 ? false : false;
  return 'Вы: '+(adj?adj+' ':'')+noun+(me.label?' '+me.label:'');
}
function render(sc, catalog){
  catalog=catalog||{};
  var ctx={id:(++uid), markers:[], defs:'', mpaths:'', vseq:0, mseq:0, sign:function(c){ return dynSign(c, catalog); }};
  var body='';
  try{
    if(sc.type==='cross'||sc.type==='t') body=renderCross(sc, ctx);
    else if(sc.type==='round') body=renderRound(sc, ctx);
    else if(sc.type==='road'||sc.type==='rail') body=renderRoad(sc.type==='rail'&&!sc.rail?Object.assign({},sc,{rail:{}}):sc, ctx);
    else if(sc.type==='signal') body=renderSignal(sc, ctx);
    else if(sc.type==='signs') body=renderSigns(sc, ctx);
    else return '';
  }catch(e){ return ''; }
  return '<svg class="scene" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Схема ситуации"><defs>'+ctx.defs+'<clipPath id="sc'+ctx.id+'"><rect width="240" height="240" rx="10"/></clipPath></defs><g clip-path="url(#sc'+ctx.id+')">'+body+ctx.mpaths+'</g></svg>';
}
var API={render:render, knownSign:knownSign, signCodes:signCodes, dynSign:dynSign, caption:caption, DIMS:DIMS};
if(typeof module!=='undefined' && module.exports) module.exports=API; else root.PDDScene=API;
})(this);
