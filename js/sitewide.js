(()=>{"use strict";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
let sb=null,authBound=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function createSupabaseClient(){
  if(window.CROW_SUPABASE?.auth)return window.CROW_SUPABASE;
  if(!window.supabase?.createClient)return null;
  try{
    const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    window.CROW_SUPABASE=client; return client;
  }catch(e){console.warn("[CrowRules Sitewide] Supabase init failed",e);return null;}
}
async function getSupabase(){
  if(sb)return sb;
  for(let i=0;i<40;i++){sb=createSupabaseClient();if(sb)return sb;await wait(250);}
  return null;
}
window.CrowRulesSite=Object.freeze({supabaseUrl:SUPABASE_URL,product:"CrowRules Podcasting",version:"2.0"});
const page=(location.pathname.split("/").pop()||"home.html").toLowerCase();
const nav=[["home.html","Home"],["discover.html","Discover"],["rankings.html","Rankings"],["library.html","Library"],["creator-studio.html","Studio"],["membership.html","Membership"],["community.html","Community"],["launch.html","Launch"]];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function shell(){
 if(document.querySelector(".sitewide-header"))return;
 document.querySelector(".site-header")?.remove();
 const h=document.createElement("header");h.className="sitewide-header";
 h.innerHTML='<a class="sitewide-brand" href="home.html" aria-label="CrowRules Podcasting home"><span class="sitewide-mark">C</span><span><b>CrowRules</b><small>Podcasting / Cyberspace</small></span></a><nav class="sitewide-nav" aria-label="Primary">'+nav.map(([u,l])=>'<a href="'+u+'" class="'+(page===u?"active":"")+'">'+l+'</a>').join("")+'<a class="sitewide-account" data-site-account href="auth.html">Sign In</a></nav><button class="sitewide-menu" aria-label="Open menu" aria-expanded="false">☰</button><nav class="sitewide-mobile" aria-label="Mobile">'+nav.map(([u,l])=>'<a href="'+u+'">'+l+'</a>').join("")+'<a class="sitewide-account" data-site-account href="auth.html">Sign In</a></nav>';
 document.body.prepend(h);
 const menu=h.querySelector(".sitewide-menu"),mobile=h.querySelector(".sitewide-mobile");
 menu.onclick=()=>{const open=mobile.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));};
 mobile.addEventListener("click",e=>{if(e.target.matches("a"))mobile.classList.remove("open");});
 const footer=document.createElement("footer");footer.className="sitewide-footer";
 footer.innerHTML='CROWRULES PODCASTING • CYBERSPACE AUDIO NETWORK • <a href="https://crowrulesentertainment-oss.github.io/crowrulesentertainment/">CrowRules Entertainment</a><span class="sitewide-status" aria-live="polite"> • SYSTEM ONLINE</span>';document.body.append(footer);
 player();
}
function player(){
 if(document.querySelector(".sitewide-player"))return;
 const p=document.createElement("div");p.className="sitewide-player";
 p.innerHTML='<div class="player-info"><div class="player-title" id="playerTitle">Nothing playing</div><div class="player-sub" id="playerSub">CrowRules cyberspace audio link offline</div><div class="player-progress"><span id="playerProgress"></span></div></div><div class="player-controls"><button id="playerPlay" class="primary" aria-label="Play or pause">▶</button><button id="playerMute" aria-label="Mute">🔊</button><button id="playerClose" aria-label="Close player">×</button></div>';
 document.body.append(p);
 const audio=document.createElement("audio");audio.id="crAudio";audio.preload="metadata";audio.setAttribute("aria-label","CrowRules Podcasting audio");document.body.append(audio);
 let saved=null;try{saved=JSON.parse(localStorage.getItem("crowrules_audio")||"null")}catch{}
 const title=document.getElementById("playerTitle"),sub=document.getElementById("playerSub"),play=document.getElementById("playerPlay"),mute=document.getElementById("playerMute"),close=document.getElementById("playerClose"),progress=document.getElementById("playerProgress");
 if(saved?.src){audio.src=saved.src;title.textContent=saved.title||"CrowRules Podcast";sub.textContent=saved.sub||"Ready to resume";audio.currentTime=Number(saved.time)||0;}
 play.onclick=()=>audio.paused?audio.play().catch(()=>{}):audio.pause();
 mute.onclick=()=>{audio.muted=!audio.muted;mute.textContent=audio.muted?"🔇":"🔊";};
 close.onclick=()=>{audio.pause();audio.removeAttribute("src");localStorage.removeItem("crowrules_audio");title.textContent="Nothing playing";sub.textContent="CrowRules cyberspace audio link offline";progress.style.width="0%";};
 audio.onplay=()=>play.textContent="Ⅱ";audio.onpause=()=>play.textContent="▶";
 audio.ontimeupdate=()=>{if(audio.duration){progress.style.width=(audio.currentTime/audio.duration*100)+"%";if(audio.currentTime>0&&audio.currentTime%5<.25)localStorage.setItem("crowrules_audio",JSON.stringify({src:audio.src,title:title.textContent,sub:sub.textContent,time:audio.currentTime}));}};
 audio.onended=()=>{play.textContent="▶";progress.style.width="0%";};
 window.CrowRulesPlay=(src,name,detail)=>{if(!src)return;audio.src=src;title.textContent=name||"CrowRules Podcast";sub.textContent=detail||"Now playing";localStorage.setItem("crowrules_audio",JSON.stringify({src,title:name||"CrowRules Podcast",sub:detail||"Now playing",time:0}));audio.play().catch(()=>{});};
}
function toast(m){let t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.append(t)}t.textContent=m;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),3200)}
window.CrowRulesToast=toast;
async function account(){
 const client=await getSupabase();if(!client)return;
 try{
  const result=await client.auth.getSession(),session=result?.data?.session||null;
  document.querySelectorAll("[data-site-account]").forEach(a=>{a.textContent=session?"My Account":"Sign In";a.href=session?"account.html":"auth.html";});
  if(!authBound){authBound=true;client.auth.onAuthStateChange((_event,newSession)=>{document.querySelectorAll("[data-site-account]").forEach(a=>{a.textContent=newSession?"My Account":"Sign In";a.href=newSession?"account.html":"auth.html";});});}
 }catch(e){console.warn("[CrowRules Sitewide] Auth session unavailable",e)}
}
function hero3d(){
 const root=document.querySelector(".hero");if(!root||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 let raf=0;document.addEventListener("mousemove",e=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const x=(innerWidth/2-e.clientX)/innerWidth,y=(innerHeight/2-e.clientY)/innerHeight;root.style.transform="perspective(1200px) rotateY("+(x*2.2)+"deg) rotateX("+(y*-1.7)+"deg)";});});
}
document.addEventListener("DOMContentLoaded",()=>{shell();account();hero3d();});
})();