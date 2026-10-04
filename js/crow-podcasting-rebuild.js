(()=>{"use strict";
if(window.__CROW_PODCASTING_REBUILD_V12__)return;
window.__CROW_PODCASTING_REBUILD_V12__=true;

const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const STRIPE="https://js.stripe.com/v3/";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const page=()=>location.pathname.split("/").pop().toLowerCase()||"home.html";
const load=(src,attrs={})=>new Promise((res,rej)=>{
  const existing=[...document.scripts].find(s=>s.src===src||s.src.startsWith(src+"?"));
  if(existing){if(existing.dataset.loaded==="1")return res();existing.addEventListener("load",()=>res(),{once:true});existing.addEventListener("error",()=>rej(new Error("Unable to load "+src)),{once:true});return}
  const s=document.createElement("script");s.src=src;Object.assign(s,attrs);s.onload=()=>{s.dataset.loaded="1";res()};s.onerror=()=>rej(new Error("Unable to load "+src));document.head.appendChild(s);
});
async function bootClients(){
  try{
    if(!window.supabase?.createClient)await load(CDN);
    if(!window.CROW_CONFIG_READY)await load(BASE+"js/config.js?v=20261004-17");
    const cfg=window.CROW_CONFIG||{};
    if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error("CrowRules Supabase configuration is incomplete.");
    if(!window.CROW_SUPABASE)window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
    });
    window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);
    window.CROW_DATA=window.CROW_DATA||{};
    window.CROW_DATA.ready=async(timeout=10000)=>{
      const p=window.CROW_SUPABASE_READY;
      if(!p)return null;
      return await Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Supabase initialization timeout.")),timeout))]);
    };
    const session=await window.CROW_SUPABASE.auth.getSession();
    window.__CROW_USER=session.data?.session?.user||null;
    window.__CROW_AUTH_READY=true;
    window.CROW_SUPABASE.auth.onAuthStateChange((_event,s)=>{
      window.__CROW_USER=s?.user||null;
      window.__CROW_AUTH_READY=true;
      window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event:_event,session:s,user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));
      window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user:window.__CROW_USER,session:s}}));
    });
    if(window.Stripe===undefined&&cfg.stripePublishableKey)try{await load(STRIPE)}catch(_){}
    if(window.Stripe&&cfg.stripePublishableKey&&!window.CROW_STRIPE)window.CROW_STRIPE=window.Stripe(cfg.stripePublishableKey);
    window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user:window.__CROW_USER,session:session.data?.session||null}}));
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    return window.CROW_SUPABASE;
  }catch(e){
    window.CROW_SUPABASE_ERROR=e;
    window.CROW_SUPABASE_READY=Promise.reject(e);
    window.CROW_DATA=window.CROW_DATA||{};
    window.CROW_DATA.ready=async()=>{throw e};
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"CONNECTION ERROR"}}));
    throw e;
  }
}
function cleanLegacy(){
  document.querySelectorAll("[data-nav],#crMobileNav,#crConnection,#crRebuildNav,#cr12SiteNav,#cr12SearchButton,#cr12HomeButton,.cr-nav").forEach(n=>n.remove());
  document.documentElement.classList.add("cr-rebuild");
  document.body.classList.add("cr-app");
}
function navMenu(label,items){
  return '<div class="nav-group"><button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false"><i>'+items.icon+'</i><span class="label">'+label+'</span><span class="chevron">⌄</span></button><div class="nav-menu"><div class="menu-label">'+items.label+'</div>'+
    items.links.map(x=>'<a href="'+BASE+x[0]+'"><b>'+x[2]+'</b>'+x[1]+'</a>').join("")+
    '</div></div>';
}
function navigation(){
  if(document.getElementById("crRebuildNav"))return;
  const p=page();
  const nav=document.createElement("header");
  nav.id="crRebuildNav";nav.className="cr-nav";nav.dataset.navigationVersion="12";
  nav.innerHTML=
    '<a class="cr-brand" href="'+BASE+'home.html"><b>CROWRULES</b><span>PODCASTING</span></a>'+
    '<nav class="cr-links" aria-label="CrowRules Podcasting Navigation">'+
      '<a class="nav-single '+(p==="home.html"?"active":"")+'" href="'+BASE+'home.html"><i>⌂</i><span>HOME</span></a>'+
      navMenu("DISCOVER",{icon:"◈",label:"DISCOVER THE NETWORK",links:[
        ["discover.html","DISCOVER HOME","◈"],["search.html","GLOBAL SEARCH","⌕"],["podcasts.html","ALL PODCASTS","◉"],["episodes.html","ALL EPISODES","▶"],["intelligence.html","INTELLIGENCE LAYER","✦"]
      ]})+
      navMenu("LIBRARY",{icon:"▣",label:"YOUR LISTENING",links:[
        ["library.html","MY LIBRARY","▣"],["library.html#continue","CONTINUE LISTENING","▶"],["notifications.html","NOTIFICATIONS","◌"]
      ]})+
      navMenu("CREATORS",{icon:"✦",label:"CREATE & MANAGE",links:[
        ["create-podcast.html","CREATE PODCAST","＋"],["creator-dashboard.html","CREATOR STUDIO","✦"],["creator-profile.html","CREATOR PROFILE","♙"]
      ]})+
      navMenu("ACCOUNT",{icon:"◎",label:"CROWRULES ACCOUNT",links:[
        ["account.html","ACCOUNT","◎"],["account.html#membership","MEMBERSHIP","★"],["account.html#settings","SETTINGS","⚙"]
      ]})+
    '</nav>'+
    '<div class="cr-tools"><button id="crGlobalSearch" title="Global search" aria-label="Global search">⌕</button><a href="'+BASE+'account.html" title="Account">◎</a></div>';
  document.body.prepend(nav);

  const groups=[...nav.querySelectorAll(".nav-group")];
  const close=()=>groups.forEach(g=>{g.classList.remove("open");g.querySelector(".nav-trigger")?.setAttribute("aria-expanded","false")});
  groups.forEach(g=>{
    const b=g.querySelector(".nav-trigger");
    b.addEventListener("click",e=>{
      e.stopPropagation();const open=g.classList.contains("open");close();
      if(!open){g.classList.add("open");b.setAttribute("aria-expanded","true")}
    });
    g.querySelector(".nav-menu").addEventListener("click",e=>e.stopPropagation());
  });
  document.addEventListener("click",close,{passive:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
function searchOverlay(){
  if(document.getElementById("crRebuildSearch"))return;
  const o=document.createElement("div");o.id="crRebuildSearch";o.className="cr-search-overlay";
  o.innerHTML='<section class="cr-search-panel"><button class="cr-search-close" aria-label="Close search">×</button><div class="cr-kicker">CROWRULES PODCASTING / INTELLIGENCE</div><h2>Find your signal.</h2><input id="crSearchInput" placeholder="Search podcasts, episodes, creators…" autocomplete="off"><div id="crSearchStatus">Type at least 2 characters.</div><div id="crSearchResults"></div></section>';
  document.body.appendChild(o);
  o.querySelector(".cr-search-close").onclick=()=>o.remove();
  o.onclick=e=>{if(e.target===o)o.remove()};
  const q=o.querySelector("#crSearchInput");q.oninput=()=>doSearch(q.value);q.focus();
}
let searchTimer;
async function doSearch(term){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(async()=>{
    const box=document.getElementById("crSearchResults"),st=document.getElementById("crSearchStatus"),sb=window.CROW_SUPABASE;
    if(!sb||term.trim().length<2){if(st)st.textContent="Type at least 2 characters.";if(box)box.innerHTML="";return}
    st.textContent="Scanning the podcast universe…";
    try{
      const t="%"+term.trim().replace(/[%_]/g,"")+"%";
      const [a,b,c]=await Promise.all([
        sb.from("podcasts").select("id,title,slug,description,artwork_url,status").eq("status","published").ilike("title",t).limit(8),
        sb.from("podcast_episodes").select("id,title,description,thumbnail_url,status").eq("status","published").ilike("title",t).limit(8),
        sb.from("creators").select("id,name,display_name,slug,bio,avatar_url,is_active").eq("is_active",true).or("name.ilike."+t+",display_name.ilike."+t).limit(8)
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
      const rows=[];
      (a.data||[]).forEach(x=>rows.push(["PODCAST",x.title,x.description,x.artwork_url,"podcast.html?slug="+encodeURIComponent(x.slug||x.id)]));
      (b.data||[]).forEach(x=>rows.push(["EPISODE",x.title,x.description,x.thumbnail_url,"episode.html?id="+encodeURIComponent(x.id)]));
      (c.data||[]).forEach(x=>rows.push(["CREATOR",x.display_name||x.name,x.bio,x.avatar_url,"creator-profile.html?slug="+encodeURIComponent(x.slug||x.id)]));
      st.textContent=rows.length?rows.length+" results":"No matches found.";
      box.innerHTML=rows.map(x=>'<a class="cr-search-row" href="'+BASE+x[4]+'">'+(x[3]?'<img src="'+esc(x[3])+'" alt="">':'<span class="cr-search-art">◉</span>')+'<span><b>'+esc(x[1])+'</b><small>'+esc(x[0])+'</small><em>'+esc(x[2]||"")+"</em></span></a>").join("");
    }catch(e){st.textContent="Search unavailable.";box.innerHTML='<div class="cr-empty">'+esc(e.message||"Connection error")+"</div>"}
  },160);
}
function status(){
  const el=document.createElement("div");el.id="crConnection";el.className="cr-connection";
  el.innerHTML='<span></span><b>CONNECTING</b>';document.body.appendChild(el);
  const set=(ok,label)=>{el.classList.toggle("ok",ok);el.querySelector("b").textContent=label};
  if(window.CROW_SUPABASE&&!window.CROW_SUPABASE_ERROR)set(true,"SUPABASE ONLINE");
  window.addEventListener("crow:connection",e=>set(!!e.detail?.ok,e.detail?.label||"CONNECTED"));
}
function shell(){
  cleanLegacy();navigation();status();
  document.getElementById("crGlobalSearch")?.addEventListener("click",searchOverlay);
  const main=document.querySelector("main");if(main&&!main.classList.contains("scene"))main.classList.add("cr-main");
  const link=document.createElement("link");link.rel="stylesheet";link.href=BASE+"css/crow-podcasting-rebuild.css?v=20261004-17";document.head.appendChild(link);
  const navCss=document.createElement("link");navCss.rel="stylesheet";navCss.href=BASE+"css/navigation-v12.css?v=20261004-17";document.head.appendChild(navCss);
}
async function start(){
  const run=async()=>{
    if(!document.body)return;
    shell();
    try{await bootClients()}catch(e){console.warn("CrowRules Supabase connection:",e)}
  };
  if(document.body)await run();else document.addEventListener("DOMContentLoaded",run,{once:true});
}
start();
})();