(()=>{"use strict";
if(window.__CROW_CYBER_BACKGROUND_V1__)return;
window.__CROW_CYBER_BACKGROUND_V1__=true;
function init(){
  if(document.getElementById("crCyberBackground"))return;
  const root=document.createElement("div");
  root.id="crCyberBackground";root.className="cr-cyber-background";
  root.setAttribute("aria-hidden","true");
  root.innerHTML='<canvas id="crCyberCanvas"></canvas><div class="cr-cyber-grid"></div><div class="cr-cyber-scanlines"></div><div class="cr-cyber-vignette"></div><div class="cr-cyber-glow cr-cyber-glow-a"></div><div class="cr-cyber-glow cr-cyber-glow-b"></div><div class="cr-cyber-glow cr-cyber-glow-c"></div>';
  document.body.prepend(root);
  const canvas=root.querySelector("#crCyberCanvas"),ctx=canvas.getContext("2d",{alpha:true});
  if(!ctx)return;
  let w=0,h=0,dpr=1,particles=[],raf=0,last=0;
  const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const resize=()=>{dpr=Math.min(window.devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+"px";canvas.style.height=h+"px";ctx.setTransform(dpr,0,0,dpr,0,0);const n=Math.min(90,Math.max(28,Math.floor(w*h/18000)));particles=Array.from({length:n},()=>({x:Math.random()*w,y:Math.random()*h,r:.5+Math.random()*1.5,v:.08+Math.random()*.28,a:.12+Math.random()*.34,p:Math.random()*Math.PI*2}));};
  const draw=t=>{raf=requestAnimationFrame(draw);if(reduce)return;if(t-last<33)return;last=t;ctx.clearRect(0,0,w,h);for(const p of particles){p.y-=p.v;if(p.y<-8)p.y=h+8;p.p+=.006;const tw=p.a*(.72+.28*Math.sin(p.p));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(101,242,255,"+tw+")";ctx.fill();} };
  resize();addEventListener("resize",resize,{passive:true});raf=requestAnimationFrame(draw);
  document.addEventListener("visibilitychange",()=>{if(document.hidden){cancelAnimationFrame(raf)}else{last=0;raf=requestAnimationFrame(draw)}},{passive:true});
}
if(document.body)init();else document.addEventListener("DOMContentLoaded",init,{once:true});
})();