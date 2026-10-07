(()=>{"use strict";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
let sb=null;

function createSupabaseClient(){
  if(window.CROW_SUPABASE?.auth) return window.CROW_SUPABASE;
  if(window.supabase?.createClient){
    try{
      return window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
    }catch(error){ console.warn("[CrowRules Sitewide] Supabase init failed",error); }
  }
  return null;
}
async function getSupabase(){
  if(sb)return sb;
  sb=createSupabaseClient();
  if(sb)return sb;
  for(let i=0;i<40;i++){
    await new Promise(r=>setTimeout(r,250));
    sb=createSupabaseClient();
    if(sb)return sb;
  }
  console.warn("[CrowRules Sitewide] Supabase client unavailable");
  return null;
}

window.CrowRulesSite=Object.freeze({supabaseUrl:SUPABASE_URL,product:"CrowRules Podcasting"});
const page=(location.pathname.split("/").pop()||"home.html").toLowerCase();
const nav=[["home.html","Home"],["discover.html","Discover"],["rankings.html","Rankings"],["library.html","Library"],["creator-studio.html","Studio"],["membership.html","Membership"],["community.html","Community"],["launch.html","Launch"]];

function shell(){
  if(document.querySelector(".sitewide-header"))return;
  document.querySelector(".site-header")?.remove();
  const h=document.createElement("header");
  h.className="sitewide-header";
  h.innerHTML='<a class="sitewide-brand" href="home.html"><span class="sitewide-mark">C</span><span><b>CrowRules</b><small>Podcasting / Cyberspace</small></span></a><nav class="sitewide-nav">'+nav.map(([u,l])=>'<a href="'+u+'" class="'+(page===u?"active":"")+'">'+l+'</a>').join("")+'<a class="sitewide-account" data-site-account href="auth.html">Sign In</a></nav><button class="sitewide-menu" aria-label="Open menu" aria-expanded="false">☰</button><nav class="sitewide-mobile">'+nav.map(([u,l])=>'<a href="'+u+'">'+l+'</a>').join("")+'<a class="sitewide-account" data-site-account href="auth.html">Sign In</a></nav>';
  document.body.prepend(h);
  const menu=h.querySelector(".sitewide-menu"),mobile=h.querySelector(".sitewide-mobile");
  menu.onclick=()=>{const open=mobile.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));};
  const footer=document.createElement("footer");
  footer.className="sitewide-footer";
  footer.innerHTML='CROWRULES PODCASTING • CYBERSPACE AUDIO NETWORK • <a href="https://crowrulesentertainment-oss.github.io/crowrulesentertainment/">CrowRules Entertainment</a>';
  document.body.append(footer);
  const player=document.createElement("div");
  player.className="sitewide-player";
  player.innerHTML='<div><div class="player-title" id="playerTitle">Nothing playing</div><div class="player-sub" id="playerSub">CrowRules cyberspace audio link offline</div></div><div class="player-controls"><button id="playerPlay" class="primary" aria-label="Play">▶</button><button id="playerClose" aria-label="Close">×</button></div>';
  document.body.append(player);
  const audio=document.createElement("audio");
  audio.id="crAudio";audio.preload="metadata";document.body.append(audio);
  const saved=JSON.parse(localStorage.getItem("crowrules_audio")||"null");
  const title=document.getElementById("playerTitle"),sub=document.getElementById("playerSub"),play=document.getElementById("playerPlay"),close=document.getElementById("playerClose");
  if(saved?.src){audio.src=saved.src;title.textContent=saved.title||"CrowRules Podcast";sub.textContent=saved.sub||"Now playing";}
  play.onclick=()=>audio.paused?audio.play().catch(()=>{}):audio.pause();
  close.onclick=()=>{audio.pause();audio.removeAttribute("src");localStorage.removeItem("crowrules_audio");title.textContent="Nothing playing";sub.textContent="CrowRules cyberspace audio link offline";};
  audio.onplay=()=>play.textContent="Ⅱ";audio.onpause=()=>play.textContent="▶";
  window.CrowRulesPlay=(src,name,detail)=>{if(!src)return;audio.src=src;title.textContent=name||"CrowRules Podcast";sub.textContent=detail||"Now playing";localStorage.setItem("crowrules_audio",JSON.stringify({src,title:name,sub:detail}));audio.play().catch(()=>{});};
  window.CrowRulesToast=m=>{let t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.append(t);}t.textContent=m;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),3200);};
}

async function account(){
  const client=await getSupabase();
  if(!client)return;
  try{
    const result=await client.auth.getSession();
    const session=result?.data?.session||null;
    document.querySelectorAll("[data-site-account]").forEach(a=>{a.textContent=session?"My Account":"Sign In";a.href=session?"account.html":"auth.html";});
    client.auth.onAuthStateChange(()=>{setTimeout(account,0);});
  }catch(error){console.warn("[CrowRules Sitewide] Auth session unavailable",error);}
}

document.addEventListener("DOMContentLoaded",async()=>{
  shell();
  account();
  const root=document.querySelector(".hero");
  if(root&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
    let raf=0;
    document.addEventListener("mousemove",e=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        const x=(innerWidth/2-e.clientX)/innerWidth,y=(innerHeight/2-e.clientY)/innerHeight;
        root.style.transform="perspective(1200px) rotateY("+(x*2.2)+"deg) rotateX("+(y*-1.7)+"deg)";
      });
    });
  }
});
})();