/* CrowRules Podcasting — sitewide shell v3 — Supabase: cevylpnoexugwgygvtgu only */
(()=>{"use strict";

const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);

window.CrowRulesSite=Object.freeze({
  supabaseUrl:SUPABASE_URL,
  product:"CrowRules Podcasting"
});

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const page=(location.pathname.split("/").pop()||"home.html").toLowerCase();

const navItems=[
  ["home.html","Home"],
  ["discover.html","Discover"],
  ["rankings.html","Rankings"],
  ["library.html","My Library"],
  ["creator-studio.html","Creator Studio"],
  ["membership.html","Membership"],
  ["community.html","Community"],
  ["launch.html","Launch"]
];

function nav(){
  let h=document.querySelector(".site-header");
  if(h) h.classList.add("sitewide-header");
  if(!h){
    h=document.createElement("header");
    h.className="sitewide-header";
    document.body.prepend(h);
  }

  const links=navItems.map(([href,label])=>{
    const active=page===href?" aria-current=\"page\" class=\"active\"":"";
    return `<a href="${href}"${active}>${label}</a>`;
  }).join("");

  h.innerHTML=`
    <a class="sitewide-brand" href="home.html" aria-label="CrowRules Podcasting home">
      <span class="sitewide-mark">C</span>
      <span><b>CrowRules</b><small>Podcasting</small></span>
    </a>
    <nav class="sitewide-nav" aria-label="Primary navigation">
      ${links}
      <a data-site-account href="auth.html">Sign In</a>
      <a href="https://crowrulesentertainment-oss.github.io/crowrulesentertainment/">CrowRules</a>
    </nav>
    <button class="sitewide-menu" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>`;

  const menu=h.querySelector(".sitewide-menu");
  const n=h.querySelector(".sitewide-nav");
  menu.onclick=()=>{
    const open=n.classList.toggle("open");
    menu.setAttribute("aria-expanded",String(open));
    menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");
  };
  n.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
    n.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
    menu.setAttribute("aria-label","Open navigation");
  }));
  return h;
}

function player(){
  if(document.querySelector(".sitewide-player")) return document.querySelector(".sitewide-player");
  const p=document.createElement("div");
  p.className="sitewide-player";
  p.setAttribute("role","region");
  p.setAttribute("aria-label","CrowRules Podcasting audio player");
  p.innerHTML=`
    <img class="player-art" alt="" decoding="async">
    <div class="player-main">
      <div class="player-title">CrowRules Podcasting</div>
      <div class="player-author">Ready to listen</div>
      <input class="player-progress" type="range" min="0" max="100" value="0" aria-label="Audio progress">
    </div>
    <div class="player-time" aria-live="polite">0:00 / 0:00</div>
    <button class="player-btn primary player-toggle" type="button" aria-label="Play">▶</button>
    <button class="player-close" type="button" aria-label="Close player">×</button>
    <audio preload="metadata"></audio>`;
  document.body.appendChild(p);
  return p;
}

let p,a,playerBound=false;

function fmt(v){
  if(!Number.isFinite(v)||v<0) return "0:00";
  const m=Math.floor(v/60),s=Math.floor(v%60);
  return m+":"+String(s).padStart(2,"0");
}

function api(){
  p=p||player();
  a=p.querySelector("audio");
  return{p,a};
}

function setArt(el,url){
  el.src=url||"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111722"/><text x="40" y="48" text-anchor="middle" fill="#5ee7ff" font-size="22" font-family="Arial">CR</text></svg>'
  );
}

function updateButton(){
  const x=api();
  const b=x.p.querySelector(".player-toggle");
  b.textContent=x.a.paused?"▶":"Ⅱ";
  b.setAttribute("aria-label",x.a.paused?"Play":"Pause");
}

function bindPlayer(){
  if(playerBound) return;
  playerBound=true;
  const x=api(),range=x.p.querySelector(".player-progress");
  x.p.querySelector(".player-toggle").onclick=()=>x.a.paused?x.a.play().catch(()=>{}):x.a.pause();
  x.p.querySelector(".player-close").onclick=()=>{x.a.pause();x.p.classList.remove("visible")};
  range.oninput=()=>{if(Number.isFinite(x.a.duration)&&x.a.duration>0)x.a.currentTime=(Number(range.value)/100)*x.a.duration};
  x.a.addEventListener("play",updateButton);
  x.a.addEventListener("pause",updateButton);
  x.a.addEventListener("timeupdate",()=>{
    if(x.a.duration){
      range.value=x.a.currentTime/x.a.duration*100;
      x.p.querySelector(".player-time").textContent=fmt(x.a.currentTime)+" / "+fmt(x.a.duration);
    }
  });
  x.a.addEventListener("ended",()=>{range.value=0;updateButton()});
  if("mediaSession"in navigator){
    x.a.addEventListener("loadedmetadata",()=>{
      try{
        navigator.mediaSession.metadata=new MediaMetadata({
          title:x.a.dataset.title||"CrowRules Podcasting",
          artist:x.a.dataset.author||"CrowRules Creator"
        });
      }catch{}
    });
    try{navigator.mediaSession.setActionHandler?.("play",()=>x.a.play());}catch{}
    try{navigator.mediaSession.setActionHandler?.("pause",()=>x.a.pause());}catch{}
  }
}

function play(item){
  if(!item?.url) return;
  const x=api();
  bindPlayer();
  const same=x.a.src===item.url;
  if(!same){
    x.a.src=item.url;
    x.a.dataset.title=item.title||"CrowRules Podcasting";
    x.a.dataset.author=item.author||"CrowRules Creator";
    x.a.dataset.art=item.artwork||"";
    x.a.currentTime=0;
  }
  x.p.querySelector(".player-title").textContent=item.title||"CrowRules Podcasting";
  x.p.querySelector(".player-author").textContent=item.author||"CrowRules Creator";
  setArt(x.p.querySelector(".player-art"),item.artwork);
  x.p.classList.add("visible");
  try{localStorage.setItem("crowrules_audio",JSON.stringify(item));}catch{}
  x.a.play().catch(()=>{});
  updateButton();
}

async function account(){
  const el=document.querySelector("[data-site-account]");
  if(!el||!sb) return;
  const render=session=>{
    if(session){
      const email=session.user?.email||"";
      el.textContent="My Account";
      el.href="account.html";
      el.classList.add("account");
      el.title=email?esc(email):"My Account";
      el.setAttribute("aria-label",email?"My Account — "+email:"My Account");
    }else{
      el.textContent="Sign In";
      el.href="auth.html";
      el.classList.remove("account");
      el.removeAttribute("title");
      el.setAttribute("aria-label","Sign In");
    }
  };

  try{
    const {data,error}=await sb.auth.getSession();
    if(error) throw error;
    render(data?.session||null);
    const {data:listener}=sb.auth.onAuthStateChange((_event,session)=>render(session));
    window.addEventListener("pagehide",()=>listener?.subscription?.unsubscribe?.(),{once:true});
  }catch(error){
    console.warn("CrowRules Podcasting auth state unavailable:",error);
    render(null);
  }
}

function restorePlayer(){
  try{
    const saved=JSON.parse(localStorage.getItem("crowrules_audio")||"null");
    if(!saved?.url) return;
    const x=api();
    x.p.querySelector(".player-title").textContent=saved.title||"CrowRules Podcasting";
    x.p.querySelector(".player-author").textContent=saved.author||"CrowRules Creator";
    setArt(x.p.querySelector(".player-art"),saved.artwork);
    x.a.src=saved.url;
    x.a.dataset.title=saved.title||"";
    x.a.dataset.author=saved.author||"";
    x.p.classList.add("visible");
  }catch{}
}

window.CrowAudioPlayer={play};

document.addEventListener("DOMContentLoaded",()=>{
  nav();
  api();
  bindPlayer();
  account();
  restorePlayer();
});
})();