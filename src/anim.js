/* Animate vehicles of a rendered scene along their motion paths.
   steps: [["id1"],["id2","id3"]] - groups move one after another. */
function pddAnimate(svg, steps, opts){
  opts=opts||{}; var dur=opts.dur||1500, gap=opts.gap||200;
  if(!svg||!steps||!steps.length) return null;
  var cars={}; svg.querySelectorAll('.veh[data-car]').forEach(function(g){ cars[g.getAttribute('data-car')]=g; });
  var plan=[];
  steps.forEach(function(ids,i){ (Array.isArray(ids)?ids:[ids]).forEach(function(id){ var g=cars[id]; if(!g) return; var pid=g.getAttribute('data-mpath'); if(!pid) return; var path=svg.getElementById?svg.getElementById(pid):svg.querySelector('#'+pid); if(!path) return; plan.push({g:g, vb:g.querySelector('.vb'), vl:g.querySelector('.vl'), path:path, len:path.getTotalLength(), start:i*(dur+gap)}); }); });
  if(!plan.length) return null;
  svg.querySelectorAll('.arr').forEach(function(a){ a.style.transition='opacity .3s'; a.style.opacity='0.18'; });
  svg.querySelectorAll('.ped').forEach(function(p){ p.style.transition='opacity .6s'; p.style.opacity='0'; });
  var t0=null, stopped=false, raf=(typeof requestAnimationFrame!=='undefined')?requestAnimationFrame:function(cb){return setTimeout(function(){cb(Date.now());},16);};
  function ease(k){ return k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; }
  function frame(ts){
    if(stopped) return; if(t0==null) t0=ts; var t=ts-t0, running=false;
    plan.forEach(function(p){
      var k=(t-p.start)/dur; if(k<0){ running=true; return; } if(k>1) k=1; else running=true;
      var L=ease(k)*p.len, pt=p.path.getPointAtLength(L), a=p.path.getPointAtLength(Math.max(0,L-1.5)), b=p.path.getPointAtLength(Math.min(p.len,L+1.5));
      var ang=Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI+90;
      p.vb.setAttribute('transform','translate('+pt.x.toFixed(1)+' '+pt.y.toFixed(1)+') rotate('+ang.toFixed(1)+')');
      if(p.vl) p.vl.setAttribute('transform','translate('+pt.x.toFixed(1)+' '+pt.y.toFixed(1)+')');
    });
    if(running) raf(frame); else if(opts.onDone) opts.onDone();
  }
  raf(frame);
  return { stop:function(){ stopped=true; } };
}
if(typeof module!=='undefined') module.exports=pddAnimate;
