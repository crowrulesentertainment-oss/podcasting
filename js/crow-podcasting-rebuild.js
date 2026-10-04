(()=>{"use strict";
if(window.__CROW_PODCASTING_REBUILD_V1232__)return;
window.__CROW_PODCASTING_REBUILD_V1232__=true;

const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const page=()=>location.pathname.split("/").pop().toLowerCase()||"home.html";
const load=(src,attrs={})=>new Promise((res,rej)=>{
  const existing=[...document.scripts].find(s=>s.src===src||s.src.startsWith(src+"?"));
  if(existing){if(existing.dataset.loaded==="1")return res();existing.addEventListener("load",res,{once:true});existing.addEventListener("error",()=>rej(new Error("Unable to load "+src)),{once:true});return}
  const s=document.createElement("script");s.src=src;Object.assign(s,attrs);s.onload=()=>{s.dataset.loaded="1";res()};s.onerror=()=>rej(new Error("Unable to load "+src));document.head.appendChild(s);
});
async function bootClients(){
  try{
    if(!window.supabase?.createClient)await load(CDN);
    if(!window.CROW_CONFIG_READY)await load(BASE+"js/config.js?v=20261004-20");
    const cfg=window.CROW_CONFIG||{};
    if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error("CrowRules Supabase configuration is incomplete.");
    if(!window.CROW_SUPABASE)window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);
    window.CROW_BOOTSTRAP=bootClients;
    window.CROW_DATA=window.CROW_DATA||{};
    window.CROW_DATA.ready=async(timeout=10000)=>Promise.race([window.CROW_SUPABASE_READY,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Supabase initialization timeout.")),timeout))]);
    const auth=window.CROW_SUPABASE.auth;
    const sessionResult=await auth.getSession();
    let user=sessionResult.data?.session?.user||null;
    try{const fresh=await auth.getUser();user=fresh.data?.user||user}catch(_){}
    window.__CROW_USER=user;window.__CROW_AUTH_READY=true;
    auth.onAuthStateChange(async(event,s)=>{
      window.__CROW_USER=s?.user||null;window.__CROW_AUTH_READY=true;
      window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session:s,user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));
      window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user:window.__CROW_USER,session:s}}));
      setTimeout(()=>{context();startPresence()},0);
    });
    window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user,session:sessionResult.data?.session||null}}));
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    return window.CROW_SUPABASE;
  }catch(e){
    window.CROW_SUPABASE_ERROR=e;const failed=Promise.reject(e);failed.catch(()=>{});window.CROW_SUPABASE_READY=failed;window.CROW_BOOTSTRAP=bootClients;
    window.CROW_DATA=window.CROW_DATA||{};window.CROW_DATA.ready=async()=>{throw e};
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"CONNECTION ERROR"}}));throw e;
  }
}
function cleanLegacy(){
  document.querySelectorAll("[data-nav],#crMobileNav,#crConnection,#crRebuildNav,#cr12SiteNav,#cr12SearchButton,#cr12HomeButton,.cr-nav").forEach(n=>n.remove());
  document.documentElement.classList.add("cr-rebuild");document.body.classList.add("cr-app");
}
function badge(id){return '<span class="nav-badge" data-badge="'+id+'"></span>'}
function navMenu(label,items){
  return '<div class="nav-group"><button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false"><i>'+items.icon+'</i><span class="label">'+label+'</span>'+badge(items.badge||"")+'<span class="chevron">⌄</span></button><div class="nav-menu"><div class="menu-label">'+items.label+'</div>'+
    items.links.map(x=>'<a href="'+BASE+x[0]+'"><b>'+x[2]+'</b><span>'+x[1]+'</span>'+(x[3]?badge(x[3]):"")+'</a>').join("")+'</div></div>';
}
function navigation(){
  if(document.getElementById("crRebuildNav"))return;
  const p=page(),nav=document.createElement("header");nav.id="crRebuildNav";nav.className="cr-nav";nav.dataset.navigationVersion="12.3.2";
  nav.innerHTML='<a class="cr-brand" href="'+BASE+'home.html"><b>CROWRULES</b><span>PODCASTING</span></a><nav class="cr-links" aria-label="CrowRules Podcasting Navigation">'+
    '<a class="nav-single '+(p==="home.html"?"active":"")+'" href="'+BASE+'home.html"><i>⌂</i><span>HOME</span></a>'+
    navMenu("DISCOVER",{icon:"◈",label:"LIVE NETWORK / DISCOVER",badge:"activity",links:[["discover.html","DISCOVER HOME","◈"],["presence.html","WHO HERE · LIVE NETWORK","●","activity"],["search.html","GLOBAL SEARCH","⌕"],["podcasts.html","ALL PODCASTS","◉"],["episodes.html","ALL EPISODES","▶"],["intelligence.html","INTELLIGENCE LAYER","✦"]]})+
    navMenu("LIBRARY",{icon:"▣",label:"YOUR LISTENING",badge:"library",links:[["library.html","MY LIBRARY","▣"],["library.html#continue","CONTINUE LISTENING","▶","continue"],["notifications.html","NOTIFICATIONS","◌","notifications"]]})+
    navMenu("CREATORS",{icon:"✦",label:"CREATE & MANAGE",badge:"creator",links:[["create-podcast.html","CREATE PODCAST","＋"],["creator-dashboard.html","CREATOR STUDIO","✦","creator"],["creator-profile.html","CREATOR PROFILE","♙"]]})+
    navMenu("ACCOUNT",{icon:"◎",label:"CROWRULES ACCOUNT",badge:"account",links:[["account.html","ACCOUNT","◎"],["account.html#membership","MEMBERSHIP","★"],["account.html#settings","SETTINGS","⚙"]]})+
    '</nav><div class="cr-tools"><button id="crGlobalSearch" title="Global search" aria-label="Global search">⌕</button><a id="crAccountButton" href="'+BASE+'account.html" title="Account">◎</a></div>';
  document.body.prepend(nav);
  const groups=[...nav.querySelectorAll(".nav-group")],close=()=>groups.forEach(g=>{g.classList.remove("open");g.querySelector(".nav-trigger")?.setAttribute("aria-expanded","false")});
  groups.forEach(g=>{const b=g.querySelector(".nav-trigger");b.addEventListener("click",e=>{e.stopPropagation();const open=g.classList.contains("open");close();if(!open){g.classList.add("open");b.setAttribute("aria-expanded","true")}});g.querySelector(".nav-menu").addEventListener("click",e=>e.stopPropagation())});
  document.addEventListener("click",close,{passive:true});document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
async function context(){
  const sb=window.CROW_SUPABASE;if(!sb)return;
  const user=window.__CROW_USER;
  const set=(id,v,show=true)=>{document.querySelectorAll('[data-badge="'+id+'"]').forEach(e=>{e.textContent=v||"";e.classList.toggle("has-value",show&&!!v)})};
  set("activity",window.CROW_PRESENCE_COUNT?String(window.CROW_PRESENCE_COUNT):"0",true);
  set("account",user?"SIGNED IN":"SIGN IN",true);
  if(!user){set("library","");set("continue","");set("notifications","");set("creator","");return}
  try{
    const uid=user.id;
    const [m,n,p]=await Promise.all([
      sb.from("members").select("display_name,username,membership_type,role,status").eq("user_id",uid).maybeSingle(),
      sb.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("is_read",false),
      sb.from("podcast_episode_progress").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("completed",false),
    ]);
    if(n.error)console.warn("Notification context:",n.error.message);
    if(p.error)console.warn("Listening context:",p.error.message);
    const member=m.data||null; let creator=null; if(member?.id){const cr=await sb.from("creators").select("id,name,display_name,role,is_active").eq("member_id",member.id).maybeSingle(); if(!cr.error)creator=cr.data||null;}
    window.CROW_MEMBER_CONTEXT={user,member,creator};
    set("account",member?.display_name||member?.username||"SIGNED IN",true);
    set("notifications",n.count>0?String(n.count):"");
    set("continue",p.count>0?String(p.count):"");
    set("library",(n.count||0)+(p.count||0)>0?String((n.count||0)+(p.count||0)):"");
    set("creator",creator?"CREATOR":"");
    const account=document.getElementById("crAccountButton");if(account){account.title=member?.display_name||user.email||"Signed in";account.setAttribute("aria-label",member?.display_name||"Signed in")}
  }catch(e){console.warn("V12.1 member context:",e)}
}
function bindAudioPresence(){
  document.querySelectorAll("audio").forEach(a=>{if(a.dataset.crowPresenceBound)return;a.dataset.crowPresenceBound="1";["play","pause","ended"].forEach(ev=>a.addEventListener(ev,updatePresenceMeta));});
}
function realtime(){
  const sb=window.CROW_SUPABASE;if(!sb)return;
  try{
    const data=sb.channel("crowrules-podcasting-nav-v122")
      .on("postgres_changes",{event:"*",schema:"public",table:"podcast_notifications"},()=>context())
      .on("postgres_changes",{event:"*",schema:"public",table:"podcast_episode_progress"},()=>context())
      .on("postgres_changes",{event:"*",schema:"public",table:"podcasts"},()=>document.querySelector('[data-badge="activity"]')?.classList.add("pulse"))
      .subscribe();
    window.CROW_NAV_REALTIME=data;
    startPresence();bindAudioPresence();document.addEventListener("visibilitychange",updatePresenceMeta,{passive:true});setInterval(bindAudioPresence,5000);
  }catch(e){console.warn("Podcasting navigation realtime:",e)}
}
function startPresence(){
  const sb=window.CROW_SUPABASE,u=window.__CROW_USER;if(!sb)return;
  if(window.CROW_PRESENCE_CHANNEL){try{sb.removeChannel(window.CROW_PRESENCE_CHANNEL)}catch(_){}window.CROW_PRESENCE_CHANNEL=null}
  if(!u){setPresence(0);return}
  try{
    const channel=sb.channel("crowrules-podcasting-presence",{config:{private:true,presence:{key:u.id}}})
      .on("presence",{event:"sync"},()=>syncPresence(channel))
      .on("presence",{event:"join"},()=>syncPresence(channel))
      .on("presence",{event:"leave"},()=>syncPresence(channel))
      .subscribe(async(status,err)=>{
        if(status==="SUBSCRIBED"){
          await channel.track({user_id:u.id,online_at:new Date().toISOString(),page:page(),mode:"browser",title:document.title});
          syncPresence(channel);
        }else if(err){console.warn("Podcasting presence:",err)}
      });
    window.CROW_PRESENCE_CHANNEL=channel;
  }catch(e){console.warn("Podcasting presence:",e)}
}
function updatePresenceMeta(){
  const ch=window.CROW_PRESENCE_CHANNEL,u=window.__CROW_USER;if(!ch||!u)return;
  try{const a=[...document.querySelectorAll("audio")].find(x=>!x.paused&&!x.ended&&x.currentTime>0);ch.track({user_id:u.id,online_at:new Date().toISOString(),page:page(),mode:a?"listener":"browser",title:document.title})}catch(e){}
}
function setPresence(count,members){
  const n=Math.max(0,Number(count)||0);window.CROW_PRESENCE_COUNT=n;
  if(members)window.CROW_ONLINE_MEMBERS=members;
  document.querySelectorAll('[data-badge="activity"]').forEach(e=>{e.textContent=String(n);e.classList.toggle("has-value",true);e.classList.toggle("presence-live",n>0)});
  const nav=document.getElementById("crRebuildNav");if(nav){nav.dataset.onlineMembers=String(n);nav.title=n===1?"1 member online":n+" members online";}
  window.dispatchEvent(new CustomEvent("crow:presence",{detail:{count:n,members:window.CROW_ONLINE_MEMBERS||[]}}));
}
async function syncPresence(channel){
  try{
    const state=channel.presenceState()||{},ids=Object.keys(state);
    const metas=ids.map(id=>state[id]?.[0]||{}).map((m,i)=>({user_id:m.user_id||ids[i],online_at:m.online_at||null,page:m.page||""}));
    if(!ids.length){setPresence(0,[]);return}
    const sb=window.CROW_SUPABASE;
    setPresence(ids.length,metas);
    const q=await sb.from("members").select("user_id,display_name,username,avatar_url,role").in("user_id",ids);
    if(q.error){console.warn("Presence member enrichment:",q.error.message);return}
    const byId=new Map((q.data||[]).map(x=>[x.user_id,x]));
    const members=metas.map(m=>({...m,...(byId.get(m.user_id)||{})}));
    setPresence(ids.length,members);
  }catch(e){console.warn("Presence sync:",e)}
}
function searchOverlay(){
  if(document.getElementById("crRebuildSearch"))return;
  const o=document.createElement("div");o.id="crRebuildSearch";o.className="cr-search-overlay";
  o.innerHTML='<section class="cr-search-panel"><button class="cr-search-close" aria-label="Close search">×</button><div class="cr-kicker">CROWRULES PODCASTING / INTELLIGENCE</div><h2>Find your signal.</h2><input id="crSearchInput" placeholder="Search podcasts, episodes, creators…" autocomplete="off"><div id="crSearchStatus">Type at least 2 characters.</div><div id="crSearchResults"></div></section>';
  document.body.appendChild(o);o.querySelector(".cr-search-close").onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};const q=o.querySelector("#crSearchInput");q.oninput=()=>doSearch(q.value);q.focus();
}
let searchTimer;
async function doSearch(term){clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{const box=document.getElementById("crSearchResults"),st=document.getElementById("crSearchStatus"),sb=window.CROW_SUPABASE;if(!sb||term.trim().length<2){if(st)st.textContent="Type at least 2 characters.";if(box)box.innerHTML="";return}st.textContent="Scanning the podcast universe…";try{const t="%"+term.trim().replace(/[%_]/g,"")+"%";const [a,b,c]=await Promise.all([sb.from("podcasts").select("id,title,slug,description,artwork_url,status").eq("status","published").ilike("title",t).limit(8),sb.from("podcast_episodes").select("id,title,description,thumbnail_url,status").eq("status","published").ilike("title",t).limit(8),sb.from("creators").select("id,name,display_name,slug,bio,avatar_url,is_active").eq("is_active",true).or("name.ilike."+t+",display_name.ilike."+t).limit(8)]);if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;const rows=[];(a.data||[]).forEach(x=>rows.push(["PODCAST",x.title,x.description,x.artwork_url,"podcast.html?slug="+encodeURIComponent(x.slug||x.id)]));(b.data||[]).forEach(x=>rows.push(["EPISODE",x.title,x.description,x.thumbnail_url,"episode.html?id="+encodeURIComponent(x.id)]));(c.data||[]).forEach(x=>rows.push(["CREATOR",x.display_name||x.name,x.bio,x.avatar_url,"creator-profile.html?slug="+encodeURIComponent(x.slug||x.id)]));st.textContent=rows.length?rows.length+" results":"No matches found.";box.innerHTML=rows.map(x=>'<a class="cr-search-row" href="'+BASE+x[4]+'">'+(x[3]?'<img src="'+esc(x[3])+'" alt="">':'<span class="cr-search-art">◉</span>')+'<span><b>'+esc(x[1])+'</b><small>'+esc(x[0])+'</small><em>'+esc(x[2]||"")+"</em></span></a>").join("")}catch(e){st.textContent="Search unavailable.";box.innerHTML='<div class="cr-empty">'+esc(e.message||"Connection error")+"</div>"}},160)}
function status(){const el=document.createElement("div");el.id="crConnection";el.className="cr-connection";el.innerHTML='<span></span><b>CONNECTING</b>';document.body.appendChild(el);const set=(ok,label)=>{el.classList.toggle("ok",ok);el.querySelector("b").textContent=label};if(window.CROW_SUPABASE&&!window.CROW_SUPABASE_ERROR)set(true,"SUPABASE ONLINE");window.addEventListener("crow:connection",e=>set(!!e.detail?.ok,e.detail?.label||"CONNECTED"))}
function shell(){cleanLegacy();navigation();status();document.getElementById("crGlobalSearch")?.addEventListener("click",searchOverlay);const main=document.querySelector("main");if(main&&!main.classList.contains("scene"))main.classList.add("cr-main");const link=document.createElement("link");link.rel="stylesheet";link.href=BASE+"css/crow-podcasting-rebuild.css?v=20261004-22";document.head.appendChild(link);const bg=document.createElement("script");bg.src=BASE+"js/cyber-background-v1.js?v=20261004-22";bg.defer=true;document.head.appendChild(bg);const navCss=document.createElement("link");navCss.rel="stylesheet";navCss.href=BASE+"css/navigation-v12.css?v=20261004-21";document.head.appendChild(navCss)}
async function start(){const run=async()=>{if(!document.body)return;shell();try{await bootClients();await context();realtime()}catch(e){console.warn("CrowRules Supabase connection:",e)}};if(document.body)await run();else document.addEventListener("DOMContentLoaded",run,{once:true})}
start();
})();