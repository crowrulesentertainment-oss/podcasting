/* CrowRules Podcasting Navigation V4
   Realtime operational command center. Sitewide, role-aware, capability-aware.
   Supabase authorization decisions use app_metadata only.
*/
(()=>{"use strict";
const VERSION="4.0.0";
const CONFIG=window.CROW_CONFIG||{};
const SUPABASE_URL=CONFIG.supabaseUrl||"https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY=CONFIG.supabaseKey||window.CROW_SUPABASE_KEY||window.SUPABASE_ANON_KEY;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const here=()=>location.pathname.split("/").pop()||"index.html";
const common=[["⌂","Home","home.html"],["◉","Podcasts","podcasts.html"],["✦","Discover","discover.html"],["▣","Episodes","episodes.html"],["⌕","Search","search.html"]];
const listener=[["♡","Following","library.html#following"],["★","Favorites","library.html#favorites"],["◷","Listening History","library.html#history"]];
const creatorBase=[["▦","My Shows","podcasts.html"],["＋","Episodes","create-episode.html"],["✚","Create","create-podcast.html"],["⌘","Studio","creator-dashboard.html"],["◈","Analytics","analytics.html"],["$","Earnings","creator-payouts.html"]];
const adminBase=[["⚙","Admin Center","admin.html"],["✓","Moderation","admin.html?view=moderation"],["⇧","Publishing","publishing-pipeline.html"],["♥","Health","admin.html?view=health"],["◈","Analytics","admin.html?view=analytics"]];
function isAdmin(u){const m=u?.app_metadata||{};return m.is_admin===true||m.admin===true||["admin","administrator","superadmin"].includes(String(m.role||"").toLowerCase())||(Array.isArray(m.roles)&&m.roles.some(r=>["admin","administrator","superadmin"].includes(String(r).toLowerCase())));}
async function getContext(){
 let client=window.CROW_SUPABASE;
 if(!client&&window.supabase?.createClient&&SUPABASE_KEY){try{client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});window.CROW_SUPABASE=client}catch(_){}}
 if(!client?.auth?.getSession)return {role:"listener",user:null,client};
 try{
  const {data}=await client.auth.getSession(),user=data?.session?.user||null;if(!user)return {role:"listener",user:null,client};if(isAdmin(user))return {role:"admin",user,client};
  let creator=false,creatorId=null;
  try{const q=await client.from("creators").select("id").eq("user_id",user.id).limit(1);if(!q.error&&q.data?.length){creator=true;creatorId=q.data[0].id}}catch(_){}
  if(!creator){try{const q=await client.from("creators").select("id").eq("id",user.id).limit(1);if(!q.error&&q.data?.length){creator=true;creatorId=q.data[0].id}}catch(_){}}
  const m=user.app_metadata||{};if(["creator","podcaster"].includes(String(m.role||"").toLowerCase())||m.is_creator===true)creator=true;
  return {role:creator?"creator":"listener",user,client,creatorId};
 }catch(_){return {role:"listener",user:null,client}}
}
async function count(client,table,fn){try{let q=client.from(table).select("id",{count:"exact",head:true});if(fn)q=fn(q);const r=await q;return r.error?null:Number(r.count||0)}catch(_){return null}}
async function capabilities(ctx){
 const cap={shows:false,episodes:false,monetization:false,moderation:0,publishing:0,health:0,creatorActivity:0};if(!ctx.client)return cap;
 if(ctx.role==="creator"){
  const [s,e,m,a]=await Promise.all([
   ctx.creatorId?count(ctx.client,"podcasts",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"podcast_episodes",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"cr_creator_revenue_transactions",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"cr_creator_alerts",q=>q.eq("creator_id",ctx.creatorId).is("read_at",null).is("muted_at",null)):Promise.resolve(0)
  ]);
  cap.shows=Number(s||0)>0;cap.episodes=Number(e||0)>0;cap.monetization=Number(m||0)>0;cap.creatorActivity=Number(a||0);
 }
 if(ctx.role==="admin"){
  const [m,p,h]=await Promise.all([
   count(ctx.client,"podcast_moderation_queue",q=>q.eq("status","pending")),
   count(ctx.client,"publishing_queue",q=>q.in("status",["pending","failed","scheduled"])),
   count(ctx.client,"podcast_health_alerts",q=>q.eq("resolved",false))
  ]);
  cap.moderation=Number(m||0);cap.publishing=Number(p||0);cap.health=Number(h||0);
 }
 return cap;
}
function badge(n,kind){return Number(n)>0?'<span class="crpv4-badge crpv4-'+kind+'">'+esc(Number(n)>99?"99+":n)+'</span>':""}
function item(tuple,n,kind){const [icon,label,href]=tuple,path=href.split("#")[0].split("?")[0],active=here()===path;return '<a class="crpv4-link'+(active?" active":"")+'" href="'+href+'"'+(active?' aria-current="page"':'')+'><span class="crpv4-icon" aria-hidden="true">'+icon+'</span><span>'+esc(label)+'</span>'+badge(n,kind)+'</a>'}
function group(title,items){return '<div class="crpv4-group"><div class="crpv4-group-title">'+esc(title)+'</div>'+items.map(x=>item(x[0],x[1],x[2])).join("")+'</div>'}
function roleItems(ctx,cap){
 if(ctx.role==="admin")return adminBase.map(x=>[x,x[1]==="Moderation"?cap.moderation:x[1]==="Publishing"?cap.publishing:x[1]==="Health"?cap.health:0,x[1].toLowerCase()]);
 if(ctx.role==="creator"){const a=[];if(cap.shows)a.push([creatorBase[0],0,"shows"]);if(cap.episodes)a.push([creatorBase[1],0,"episodes"]);a.push([creatorBase[2],0,"create"],[creatorBase[3],0,"studio"],[creatorBase[4],0,"analytics"]);if(cap.monetization)a.push([creatorBase[5],0,"earnings"]);return a}
 return listener.map(x=>[x,0,"listener"]);
}
async function render(ctx){
 const host=document.querySelector("[data-nav]");if(!host)return null;const cap=await capabilities(ctx),role=ctx.role,label=role==="admin"?"ADMIN COMMAND":role==="creator"?"CREATOR COMMAND":"LISTENER",ri=roleItems(ctx,cap);
 const explore=common.slice(3).map(x=>[x,0,"explore"]),account=[["◎","Library","library.html"],["♙","Profile","member-profile.html"],["⚙","Account","account.html"],["◆","Membership","membership.html"]].map(x=>[x,0,"account"]);
 const activity=role==="creator"&&cap.creatorActivity?'<span class="crpv4-live-dot" title="Live creator activity"></span>':"";
 host.innerHTML='<div class="crpv4-shell"><div class="crpv4-bar"><a class="crpv4-brand" href="home.html"><span class="crpv4-mark">CR</span><span>CROWRULES <b>PODCASTING</b></span></a><nav class="crpv4-desktop" aria-label="CrowRules Podcasting navigation"><a class="crpv4-toplink" href="home.html">Home</a><a class="crpv4-toplink" href="podcasts.html">Podcasts</a><a class="crpv4-toplink" href="discover.html">Discover</a><div class="crpv4-dropdown"><button class="crpv4-command" type="button" aria-expanded="false"><span>☰</span>'+label+activity+' <i>⌄</i></button><div class="crpv4-menu" role="menu">'+group("Explore",explore)+group(role==="admin"?"Administration":role==="creator"?"Creator Workspace":"Your Listening",ri)+'<div class="crpv4-divider"></div>'+group("Account",account)+'</div></div></nav><button class="crpv4-mobile-toggle" type="button" aria-expanded="false" aria-label="Open Podcasting command center">☰</button></div><div class="crpv4-mobile"><div class="crpv4-mobile-title">CROWRULES PODCASTING · '+label+'</div>'+group("Explore",common.map(x=>[x,0,"explore"]))+group(role==="admin"?"Administration":role==="creator"?"Creator Workspace":"Your Listening",ri)+group("Account",account)+'</div></div>';
 const dd=host.querySelector(".crpv4-command"),menu=host.querySelector(".crpv4-menu"),toggle=host.querySelector(".crpv4-mobile-toggle"),mobile=host.querySelector(".crpv4-mobile");
 dd?.addEventListener("click",e=>{e.stopPropagation();const o=menu.classList.toggle("open");dd.setAttribute("aria-expanded",String(o))});toggle?.addEventListener("click",()=>{const o=mobile.classList.toggle("open");toggle.setAttribute("aria-expanded",String(o))});host.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu?.classList.remove("open");mobile?.classList.remove("open")}));host.dataset.navVersion=VERSION;return cap;
}
async function startRealtime(ctx){
 if(!ctx.client||window.__CROW_NAV_V4_CHANNEL)return;
 const sb=ctx.client, tables=ctx.role==="admin"?["podcast_moderation_queue","publishing_queue","podcast_health_alerts"]:ctx.role==="creator"?["cr_creator_alerts","podcasts","podcast_episodes","cr_creator_revenue_transactions"]:[];
 if(!tables.length)return;
 let timer=null,running=false;
 const refresh=()=>{clearTimeout(timer);timer=setTimeout(async()=>{if(running)return;running=true;try{const next=await getContext();await render(next)}finally{running=false}},200)};
 const ch=sb.channel("crowrules-podcasting-nav-v4");
 tables.forEach(table=>ch.on("postgres_changes",{event:"*",schema:"public",table},refresh));
 ch.subscribe(status=>{window.CROW_PODCASTING_NAV_REALTIME=status;if(status!=="SUBSCRIBED")refresh()});
 window.__CROW_NAV_V4_CHANNEL=ch;
 window.__CROW_NAV_V4_POLL=setInterval(refresh,60000);
}
async function boot(){const ctx=await getContext();const cap=await render(ctx);if(ctx.client){await startRealtime(ctx);window.CrowRulesPodcastingNavV4={version:VERSION,refresh:boot,capabilities:cap,realtime:window.CROW_PODCASTING_NAV_REALTIME||"CONNECTING"}}}
const css=document.createElement("style");
css.textContent='.crpv4-shell{position:sticky;top:0;z-index:10000;font-family:Montserrat,system-ui,sans-serif}.crpv4-bar{min-height:64px;padding:9px max(18px,calc((100vw - 1400px)/2));display:flex;align-items:center;gap:24px;background:rgba(5,7,14,.94);border-bottom:1px solid #ffffff14;backdrop-filter:blur(20px);box-shadow:0 8px 35px #0006}.crpv4-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;white-space:nowrap;font:800 .72rem Orbitron,Montserrat}.crpv4-brand b{color:#55e7ff}.crpv4-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid #55e7ff55;border-radius:10px;background:linear-gradient(145deg,#55e7ff16,#a66cff16);color:#55e7ff;font-size:.65rem}.crpv4-desktop{display:flex;align-items:center;gap:6px;margin-left:auto}.crpv4-toplink,.crpv4-command{color:#c7cedd;text-decoration:none;border:1px solid transparent;background:transparent;padding:10px 11px;border-radius:10px;font:700 .67rem Montserrat;cursor:pointer}.crpv4-toplink:hover,.crpv4-command:hover{color:#fff;background:#ffffff08}.crpv4-command{border-color:#ffffff16}.crpv4-command i{font-style:normal;color:#55e7ff;margin-left:4px}.crpv4-dropdown{position:relative}.crpv4-menu{position:absolute;right:0;top:calc(100% + 10px);width:270px;max-height:min(78vh,650px);overflow:auto;padding:10px;background:rgba(8,11,20,.98);border:1px solid #ffffff18;border-radius:16px;box-shadow:0 25px 70px #000b;display:none}.crpv4-menu.open{display:block}.crpv4-group{padding:5px}.crpv4-group-title{padding:7px 9px;color:#55e7ff;font:800 .55rem Orbitron;letter-spacing:.15em;text-transform:uppercase}.crpv4-link{display:flex;align-items:center;gap:9px;padding:9px;border-radius:9px;color:#aeb7ca;text-decoration:none;font-size:.68rem}.crpv4-link:hover,.crpv4-link.active{color:#fff;background:#ffffff09}.crpv4-link.active{box-shadow:inset 2px 0 #55e7ff}.crpv4-icon{width:18px;text-align:center;color:#55e7ff}.crpv4-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:auto;padding:0 5px;border-radius:999px;background:#ff4f8b;color:#fff;font:800 .5rem Montserrat}.crpv4-divider{height:1px;background:#ffffff10;margin:6px 5px}.crpv4-mobile-toggle,.crpv4-mobile{display:none}@media(max-width:760px){.crpv4-desktop{display:none}.crpv4-bar{padding:8px 12px}.crpv4-brand{margin-right:auto}.crpv4-mobile-toggle{display:block;border:1px solid #ffffff18;background:#ffffff08;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}.crpv4-mobile{display:none;padding:10px 12px 15px;background:rgba(8,11,20,.99);border-bottom:1px solid #ffffff14}.crpv4-mobile.open{display:block}.crpv4-mobile .crpv4-group{border-top:1px solid #ffffff08}.crpv4-mobile-title{padding:8px 9px;color:#8f9bb0;font:700 .55rem Orbitron;letter-spacing:.13em}.crpv4-mobile .crpv4-link{padding:11px 10px}}@media(prefers-reduced-motion:reduce){.crpv4-menu,.crpv4-mobile{transition:none}}';
document.head.appendChild(css);
window.addEventListener("crow:auth-changed",()=>setTimeout(boot,0));window.addEventListener("crow:ready",()=>setTimeout(boot,0));if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.CrowRulesPodcastingNavV4={version:VERSION,refresh:boot};
})();