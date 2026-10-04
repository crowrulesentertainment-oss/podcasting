/* CrowRules Podcasting Navigation V6
   Realtime Operations Center — connected to the real Podcasting operations tables.
   Admin badges:
   Moderation -> podcast_member_reports
   Publishing -> cr_creator_publish_jobs_63
   Health -> cr_platform_health_checks
*/
(()=>{"use strict";
const VERSION="6.0.0";
const CONFIG=window.CROW_CONFIG||{};
const SUPABASE_URL=CONFIG.supabaseUrl||"https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY=CONFIG.supabaseKey||window.CROW_SUPABASE_KEY||window.SUPABASE_ANON_KEY;

const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
const here=()=>location.pathname.split("/").pop()||"index.html";

const common=[["⌂","Home","home.html"],["◉","Podcasts","podcasts.html"],["✦","Discover","discover.html"],["▣","Episodes","episodes.html"],["⌕","Search","search.html"]];
const listener=[["♡","Following","library.html#following"],["★","Favorites","library.html#favorites"],["◷","Listening History","library.html#history"]];
const creatorBase=[["▦","My Shows","podcasts.html"],["＋","Episodes","create-episode.html"],["✚","Create","create-podcast.html"],["⌘","Studio","creator-dashboard.html"],["◈","Analytics","analytics.html"],["$","Earnings","creator-payouts.html"]];
const adminBase=[["⚙","Admin Center","admin.html"],["✓","Moderation","admin.html?view=moderation"],["⇧","Publishing","publishing-pipeline.html"],["♥","Health","admin.html?view=health"],["◈","Analytics","admin.html?view=analytics"]];

const ADMIN_TABLES=["podcast_member_reports","cr_creator_publish_jobs_63","cr_platform_health_checks"];
const ROLE_TABLE="members";
const CREATOR_TABLES=["cr_creator_alerts","podcasts","podcast_episodes","cr_creator_revenue_transactions"];

function getClient(){
 let client=window.CROW_SUPABASE;
 if(!client&&window.supabase?.createClient&&SUPABASE_KEY){
  try{
   client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
   window.CROW_SUPABASE=client;
  }catch(_){}
 }
 return client;
}

async function getContext(){
 const client=getClient();
 if(!client?.auth?.getSession)return {role:"listener",user:null,client};
 try{
  const {data}=await client.auth.getSession();
  const user=data?.session?.user||null;
  if(!user)return {role:"listener",user:null,client};
  let creator=false,creatorId=null;
  try{
   const q=await client.from("creators").select("id").eq("user_id",user.id).limit(1);
   if(!q.error&&q.data?.length){creator=true;creatorId=q.data[0].id}
  }catch(_){}
  if(!creator){
   try{
    const q=await client.from("creators").select("id").eq("id",user.id).limit(1);
    if(!q.error&&q.data?.length){creator=true;creatorId=q.data[0].id}
   }catch(_){}
  }
  let memberRole=null;
  try{
   const r=await client.from("members").select("role").eq("user_id",user.id).maybeSingle();
   if(!r.error)memberRole=r.data?.role||null;
  }catch(_){}
  const roleName=String(memberRole||"").trim().toLowerCase();
  const admin=["admin","administrator","superadmin"].includes(roleName);
  const creatorRole=["creator","podcaster","host","producer"].includes(roleName);
  const hasCreatorAccess=creator||creatorRole;
  if(admin&&hasCreatorAccess)return {role:"admin_creator",user,client,creatorId,memberRole};
  if(admin)return {role:"admin",user,client,creatorId,memberRole};
  if(hasCreatorAccess)return {role:"creator",user,client,creatorId,memberRole};
  return {role:"listener",user,client,creatorId,memberRole};
 }catch(_){return {role:"listener",user:null,client}}
}

async function count(client,table,fn){
 try{
  let q=client.from(table).select("id",{count:"exact",head:true});
  if(fn)q=fn(q);
  const r=await q;
  return r.error?null:Number(r.count||0);
 }catch(_){return null}
}

async function capabilities(ctx){
 const cap={shows:false,episodes:false,monetization:false,moderation:0,publishing:0,health:0,creatorActivity:0};
 if(!ctx.client)return cap;

 if(ctx.role==="creator"||ctx.role==="admin_creator"){
  const [s,e,m,a]=await Promise.all([
   ctx.creatorId?count(ctx.client,"podcasts",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"podcast_episodes",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"cr_creator_revenue_transactions",q=>q.eq("creator_id",ctx.creatorId)):Promise.resolve(0),
   ctx.creatorId?count(ctx.client,"cr_creator_alerts",q=>q.eq("creator_id",ctx.creatorId).is("read_at",null).is("muted_at",null)):Promise.resolve(0)
  ]);
  cap.shows=Number(s||0)>0;
  cap.episodes=Number(e||0)>0;
  cap.monetization=Number(m||0)>0;
  cap.creatorActivity=Number(a||0);
 }

 if(ctx.role==="admin"||ctx.role==="admin_creator"){
  const [moderation,publishing,health]=await Promise.all([
   count(ctx.client,"podcast_member_reports",q=>q.not("status","in","(resolved,closed)")),
   count(ctx.client,"cr_creator_publish_jobs_63",q=>q.in("status",["queued","requested","validating","publishing","failed"])),
   count(ctx.client,"cr_platform_health_checks",q=>q.neq("status","ok"))
  ]);
  cap.moderation=Number(moderation||0);
  cap.publishing=Number(publishing||0);
  cap.health=Number(health||0);
 }
 return cap;
}

function badge(n,kind){
 return Number(n)>0?'<span class="crpv6-badge crpv6-'+kind+'">'+esc(Number(n)>99?"99+":n)+"</span>":"";
}

function item(tuple,n,kind){
 const [icon,label,href]=tuple;
 const path=href.split("#")[0].split("?")[0];
 const active=here()===path;
 return '<a class="crpv6-link'+(active?" active":"")+'" href="'+href+'"'+(active?' aria-current="page"':'')+'><span class="crpv6-icon" aria-hidden="true">'+icon+'</span><span>'+esc(label)+"</span>"+badge(n,kind)+"</a>";
}

function group(title,items){
 return '<div class="crpv6-group"><div class="crpv6-group-title">'+esc(title)+"</div>"+items.map(x=>item(x[0],x[1],x[2])).join("")+"</div>";
}

function roleItems(ctx,cap){
 const out=[];
 if(ctx.role==="admin"||ctx.role==="admin_creator")out.push(["Administration",adminBase.map(x=>[x,x[1]==="Moderation"?cap.moderation:x[1]==="Publishing"?cap.publishing:x[1]==="Health"?cap.health:0,x[1].toLowerCase()])]);
 if(ctx.role==="creator"||ctx.role==="admin_creator"){
  const a=[];
  if(cap.shows)a.push([creatorBase[0],0,"shows"]);
  if(cap.episodes)a.push([creatorBase[1],0,"episodes"]);
  a.push([creatorBase[2],0,"create"],[creatorBase[3],0,"studio"],[creatorBase[4],0,"analytics"]);
  if(cap.monetization)a.push([creatorBase[5],0,"earnings"]);
  out.push(["Creator Workspace",a]);
 }
 if(ctx.role==="listener")out.push(["Your Listening",listener.map(x=>[x,0,"listener"])]); 
 return out;
}
function labelFor(ctx){
 return ctx.role==="admin_creator"?"ADMIN + CREATOR":ctx.role==="admin"?"ADMIN COMMAND":ctx.role==="creator"?"CREATOR COMMAND":"LISTENER";
}
async function render(ctx){
 const host=document.querySelector("[data-nav]");
 if(!host)return null;
 const cap=await capabilities(ctx);
 const role=ctx.role;
 const label=labelFor(ctx);
 const ri=roleItems(ctx,cap);
 const explore=common.slice(3).map(x=>[x,0,"explore"]);
 const account=[["◎","Library","library.html"],["♙","Profile","member-profile.html"],["⚙","Account","account.html"],["◆","Membership","membership.html"]].map(x=>[x,0,"account"]);
 const activity=role==="creator"&&cap.creatorActivity?'<span class="crpv6-live-dot" title="Live creator activity"></span>':"";

 host.innerHTML='<div class="crpv6-shell"><div class="crpv6-bar"><a class="crpv6-brand" href="home.html"><span class="crpv6-mark">CR</span><span>CROWRULES <b>PODCASTING</b></span></a><nav class="crpv6-desktop" aria-label="CrowRules Podcasting navigation"><a class="crpv6-toplink" href="home.html">Home</a><a class="crpv6-toplink" href="podcasts.html">Podcasts</a><a class="crpv6-toplink" href="discover.html">Discover</a><div class="crpv6-dropdown"><button class="crpv6-command" type="button" aria-expanded="false"><span>☰</span>'+label+activity+' <i>⌄</i></button><div class="crpv6-menu" role="menu">'+group("Explore",explore)+ri+'<div class="crpv6-divider"></div>'+group("Account",account)+'</div></div></nav><button class="crpv6-mobile-toggle" type="button" aria-expanded="false" aria-label="Open Podcasting command center">☰</button></div><div class="crpv6-mobile"><div class="crpv6-mobile-title">CROWRULES PODCASTING · '+label+"</div>"+group("Explore",common.map(x=>[x,0,"explore"]))+ri+group("Account",account)+"</div></div>";

 const dd=host.querySelector(".crpv6-command");
 const menu=host.querySelector(".crpv6-menu");
 const toggle=host.querySelector(".crpv6-mobile-toggle");
 const mobile=host.querySelector(".crpv6-mobile");
 dd?.addEventListener("click",e=>{e.stopPropagation();const o=menu.classList.toggle("open");dd.setAttribute("aria-expanded",String(o))});
 toggle?.addEventListener("click",()=>{const o=mobile.classList.toggle("open");toggle.setAttribute("aria-expanded",String(o))});
 host.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu?.classList.remove("open");mobile?.classList.remove("open")}));
 host.dataset.navVersion=VERSION;
 return cap;
}

function stopRealtime(){
 const old=window.__CROW_NAV_V6_CHANNEL;
 if(old&&window.CROW_SUPABASE?.removeChannel){
  try{window.CROW_SUPABASE.removeChannel(old)}catch(_){}
 }
 window.__CROW_NAV_V6_CHANNEL=null;
 if(window.__CROW_NAV_V6_POLL){clearInterval(window.__CROW_NAV_V6_POLL);window.__CROW_NAV_V6_POLL=null}
}

async function startRealtime(ctx){
 stopRealtime();
 if(!ctx.client)return;
 const tables=ctx.role==="admin"||ctx.role==="admin_creator"?[...ADMIN_TABLES,ROLE_TABLE]:ctx.role==="creator"||ctx.role==="admin_creator"?[...CREATOR_TABLES,ROLE_TABLE]:[ROLE_TABLE];
 if(!tables.length)return;

 let timer=null,running=false;
 const refresh=()=>{
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   if(running)return;
   running=true;
   try{
    const next=await getContext();
    const cap=await render(next);
    window.CrowRulesPodcastingNavV6={version:VERSION,refresh:boot,capabilities:cap,realtime:window.CROW_PODCASTING_NAV_REALTIME||"REFRESHED"};
   }finally{running=false}
  },180);
 };

 const ch=ctx.client.channel("crowrules-podcasting-nav-v5-"+Date.now());
 tables.forEach(table=>{
   const cfg={event:"*",schema:"public",table};
   if(table===ROLE_TABLE&&ctx.user?.id)cfg.filter=`user_id=eq.${ctx.user.id}`;
   ch.on("postgres_changes",cfg,refresh);
 });
 ch.subscribe(status=>{
  window.CROW_PODCASTING_NAV_REALTIME=status;
  if(status!=="SUBSCRIBED")refresh();
 });
 window.__CROW_NAV_V6_CHANNEL=ch;
 window.__CROW_NAV_V6_POLL=setInterval(refresh,60000);
}

let bootTimer=null;
async function boot(){
 clearTimeout(bootTimer);
 bootTimer=setTimeout(async()=>{
  const ctx=await getContext();
  const cap=await render(ctx);
  await startRealtime(ctx);
  window.CrowRulesPodcastingNavV6={version:VERSION,refresh:boot,capabilities:cap,realtime:window.CROW_PODCASTING_NAV_REALTIME||"CONNECTING"};
 },80);
}

const css=document.createElement("style");
css.textContent='.crpv6-shell{position:sticky;top:0;z-index:10000;font-family:Montserrat,system-ui,sans-serif}.crpv6-bar{min-height:64px;padding:9px max(18px,calc((100vw - 1400px)/2));display:flex;align-items:center;gap:24px;background:rgba(5,7,14,.94);border-bottom:1px solid #ffffff14;backdrop-filter:blur(20px);box-shadow:0 8px 35px #0006}.crpv6-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;white-space:nowrap;font:800 .72rem Orbitron,Montserrat}.crpv6-brand b{color:#55e7ff}.crpv6-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid #55e7ff55;border-radius:10px;background:linear-gradient(145deg,#55e7ff16,#a66cff16);color:#55e7ff;font-size:.65rem}.crpv6-desktop{display:flex;align-items:center;gap:6px;margin-left:auto}.crpv6-toplink,.crpv6-command{color:#c7cedd;text-decoration:none;border:1px solid transparent;background:transparent;padding:10px 11px;border-radius:10px;font:700 .67rem Montserrat;cursor:pointer}.crpv6-toplink:hover,.crpv6-command:hover{color:#fff;background:#ffffff08}.crpv6-command{border-color:#ffffff16}.crpv6-command i{font-style:normal;color:#55e7ff;margin-left:4px}.crpv6-dropdown{position:relative}.crpv6-menu{position:absolute;right:0;top:calc(100% + 10px);width:270px;max-height:min(78vh,650px);overflow:auto;padding:10px;background:rgba(8,11,20,.98);border:1px solid #ffffff18;border-radius:16px;box-shadow:0 25px 70px #000b;display:none}.crpv6-menu.open{display:block}.crpv6-group{padding:5px}.crpv6-group-title{padding:7px 9px;color:#55e7ff;font:800 .55rem Orbitron;letter-spacing:.15em;text-transform:uppercase}.crpv6-link{display:flex;align-items:center;gap:9px;padding:9px;border-radius:9px;color:#aeb7ca;text-decoration:none;font-size:.68rem}.crpv6-link:hover,.crpv6-link.active{color:#fff;background:#ffffff09}.crpv6-link.active{box-shadow:inset 2px 0 #55e7ff}.crpv6-icon{width:18px;text-align:center;color:#55e7ff}.crpv6-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:auto;padding:0 5px;border-radius:999px;color:#fff;font:800 .5rem Montserrat}.crpv6-moderation{background:#ff4f8b}.crpv6-publishing{background:#ff9f43}.crpv6-health{background:#a66cff}.crpv6-divider{height:1px;background:#ffffff10;margin:6px 5px}.crpv6-live-dot{display:inline-block;width:7px;height:7px;margin-left:5px;border-radius:50%;background:#55e7ff;box-shadow:0 0 12px #55e7ff}.crpv6-mobile-toggle,.crpv6-mobile{display:none}@media(max-width:760px){.crpv6-desktop{display:none}.crpv6-bar{padding:8px 12px}.crpv6-brand{margin-right:auto}.crpv6-mobile-toggle{display:block;border:1px solid #ffffff18;background:#ffffff08;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}.crpv6-mobile{display:none;padding:10px 12px 15px;background:rgba(8,11,20,.99);border-bottom:1px solid #ffffff14}.crpv6-mobile.open{display:block}.crpv6-mobile .crpv6-group{border-top:1px solid #ffffff08}.crpv6-mobile-title{padding:8px 9px;color:#8f9bb0;font:700 .55rem Orbitron;letter-spacing:.13em}.crpv6-mobile .crpv6-link{padding:11px 10px}}@media(prefers-reduced-motion:reduce){.crpv6-menu,.crpv6-mobile{transition:none}}';
document.head.appendChild(css);

window.addEventListener("crow:auth-changed",boot);
window.addEventListener("crow:ready",boot);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.CrowRulesPodcastingNavV6={version:VERSION,refresh:boot};
})();