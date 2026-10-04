(()=>{"use strict";
if(window.__CROW_PODCASTING_REBUILD__)return;window.__CROW_PODCASTING_REBUILD__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const STRIPE="https://js.stripe.com/v3/";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const page=()=>location.pathname.split("/").pop().toLowerCase()||"home.html";
const load=(src,attrs={})=>new Promise((res,rej)=>{if(document.querySelector('script[src^="'+src+'"]'))return res();const s=document.createElement("script");s.src=src;Object.assign(s,attrs);s.onload=res;s.onerror=()=>rej(new Error("Unable to load "+src));document.head.appendChild(s)});
async function bootClients(){
 try{
  if(!window.supabase?.createClient)await load(CDN);
  if(!window.CROW_CONFIG_READY)await load(BASE+"js/config.js?v=20261004-16");
  const cfg=window.CROW_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error("CrowRules Supabase configuration is incomplete.");
  if(!window.CROW_SUPABASE)window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
  window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);
  if(!window.Stripe&&cfg.stripePublishableKey)try{await load(STRIPE)}catch(_){}
  if(window.Stripe&&cfg.stripePublishableKey&&!window.CROW_STRIPE)window.CROW_STRIPE=window.Stripe(cfg.stripePublishableKey);
  return window.CROW_SUPABASE;
 }catch(e){window.CROW_SUPABASE_ERROR=e;throw e}
}
function cleanLegacy(){
 document.querySelectorAll("[data-nav]").forEach(n=>n.remove());
 document.querySelectorAll("#cr12SiteNav,#cr12SearchButton,#cr12HomeButton").forEach(n=>n.remove());
 document.documentElement.classList.add("cr-rebuild");
 document.body.classList.add("cr-app");
}
function navigation(){
 if(document.getElementById("crRebuildNav"))return;
 const p=page();
 const items=[
  ["home.html","HOME","⌂"],["discover.html","DISCOVER","◈"],["podcasts.html","PODCASTS","◉"],["episodes.html","EPISODES","▶"],
  ["library.html","LIBRARY","▣"],["search.html","SEARCH","⌕"],["notifications.html","NOTIFY","◌"],["account.html","ACCOUNT","◎"]
 ];
 const nav=document.createElement("header");nav.id="crRebuildNav";nav.className="cr-nav";
 nav.innerHTML='<a class="cr-brand" href="'+BASE+'home.html"><b>CROWRULES</b><span>PODCASTING</span></a>'+
 '<nav class="cr-links" aria-label="Podcasting navigation">'+items.map(x=>'<a href="'+BASE+x[0]+'" class="'+(p===x[0]?"active":"")+'"><i>'+x[2]+'</i><span>'+x[1]+'</span></a>').join("")+'</nav>'+
 '<div class="cr-tools"><button id="crGlobalSearch" title="Global search">⌕</button><a href="'+BASE+'creator-dashboard.html" title="Creator Studio">✦</a><a href="'+BASE+'account.html" title="Account">◎</a></div>';
 document.body.prepend(nav);
}
function mobileNav(){
 if(document.getElementById("crMobileNav"))return;
 const n=document.createElement("nav");n.id="crMobileNav";n.className="cr-mobile-nav";
 n.innerHTML=[["home.html","⌂","Home"],["discover.html","◈","Discover"],["library.html","▣","Library"],["notifications.html","◌","Alerts"],["account.html","◎","Account"]].map(x=>'<a href="'+BASE+x[0]+'"><i>'+x[1]+'</i><span>'+x[2]+"</span></a>").join("");
 document.body.appendChild(n);
}
function searchOverlay(){
 if(document.getElementById("crRebuildSearch"))return;
 const o=document.createElement("div");o.id="crRebuildSearch";o.className="cr-search-overlay";
 o.innerHTML='<section class="cr-search-panel"><button class="cr-search-close">×</button><div class="cr-kicker">CROWRULES PODCASTING / GLOBAL SEARCH</div><h2>Find your signal.</h2><input id="crSearchInput" placeholder="Search podcasts, episodes, creators…" autocomplete="off"><div id="crSearchStatus">Type at least 2 characters.</div><div id="crSearchResults"></div></section>';
 document.body.appendChild(o);o.querySelector(".cr-search-close").onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};const q=o.querySelector("#crSearchInput");q.oninput=()=>doSearch(q.value);q.focus();
}
let searchTimer;
async function doSearch(term){
 clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{
  const box=document.getElementById("crSearchResults"),st=document.getElementById("crSearchStatus"),sb=window.CROW_SUPABASE;
  if(!sb||term.trim().length<2){st.textContent="Type at least 2 characters.";box.innerHTML="";return}
  st.textContent="Scanning the podcast universe…";
  try{
   const t="%"+term.trim().replace(/[%_]/g,"")+"%";
   const [a,b,c]=await Promise.all([
    sb.from("podcasts").select("id,title,slug,description,artwork_url,status").eq("status","published").ilike("title",t).limit(8),
    sb.from("podcast_episodes").select("id,title,description,thumbnail_url,status").eq("status","published").ilike("title",t).limit(8),
    sb.from("creators").select("id,name,display_name,slug,bio,avatar_url,is_active").eq("is_active",true).or("name.ilike."+t+",display_name.ilike."+t).limit(8)
   ]);
   const rows=[];(a.data||[]).forEach(x=>rows.push(["PODCAST",x.title,x.description,x.artwork_url,"podcast.html?slug="+encodeURIComponent(x.slug||x.id)]));
   (b.data||[]).forEach(x=>rows.push(["EPISODE",x.title,x.description,x.thumbnail_url,"episode.html?id="+encodeURIComponent(x.id)]));
   (c.data||[]).forEach(x=>rows.push(["CREATOR",x.display_name||x.name,x.bio,x.avatar_url,"creator-profile.html?slug="+encodeURIComponent(x.slug||x.id)]));
   st.textContent=rows.length?rows.length+" results":"No matches found.";
   box.innerHTML=rows.map(x=>'<a class="cr-search-row" href="'+BASE+x[4]+'">'+(x[3]?'<img src="'+esc(x[3])+'" alt="">':'<span class="cr-search-art">◉</span>')+'<span><b>'+esc(x[1])+'</b><small>'+esc(x[0])+'</small><em>'+esc(x[2]||"")+"</em></span></a>").join("");
  }catch(e){st.textContent="Search unavailable.";box.innerHTML='<div class="cr-empty">'+esc(e.message||"Connection error")+"</div>"}
 },160);
}
function status(){
 const el=document.createElement("div");el.id="crConnection";el.className="cr-connection";el.innerHTML='<span></span><b>CONNECTING</b>';
 document.body.appendChild(el);
 const set=(ok,label)=>{el.classList.toggle("ok",ok);el.querySelector("b").textContent=label};
 if(window.CROW_SUPABASE)set(true,"SUPABASE ONLINE");else set(false,"SUPABASE OFFLINE");
 window.addEventListener("crow:connection",e=>set(!!e.detail?.ok,e.detail?.label||"CONNECTED"));
}
function shell(){
 cleanLegacy();navigation();mobileNav();status();
 document.getElementById("crGlobalSearch")?.addEventListener("click",searchOverlay);
 const main=document.querySelector("main");if(main&&!main.classList.contains("scene"))main.classList.add("cr-main");
 const link=document.createElement("link");link.rel="stylesheet";link.href=BASE+"css/crow-podcasting-rebuild.css?v=20261004-16";document.head.appendChild(link);
}
async function start(){shell();try{await bootClients();window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE + STRIPE READY"}}));}catch(e){window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"CONNECTION ERROR"}}));console.warn("CrowRules connection:",e)}}
start();
})();