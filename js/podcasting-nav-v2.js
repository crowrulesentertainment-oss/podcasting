/* CrowRules Podcasting Navigation V2
   Context-aware sitewide command center.
   Roles: listener (default), creator, admin.
   Authorization source: Supabase app_metadata only; creator fallback is a read-only
   lookup against the creators table and never grants admin access.
*/
(()=>{"use strict";
const VERSION="2.0.0";
const CONFIG=window.CROW_CONFIG||{};
const SUPABASE_URL=CONFIG.supabaseUrl||"https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY=CONFIG.supabaseKey||window.CROW_SUPABASE_KEY||window.SUPABASE_ANON_KEY;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const here=()=>location.pathname.split("/").pop()||"index.html";
const common=[
  ["⌂","Home","home.html"],["◉","Podcasts","podcasts.html"],["✦","Discover","discover.html"],
  ["▣","Episodes","episodes.html"],["⌕","Search","search.html"]
];
const listener=[
  ["♡","Following","library.html#following"],["★","Favorites","library.html#favorites"],
  ["◷","Listening History","library.html#history"]
];
const creator=[
  ["▦","My Shows","podcasts.html"],["＋","Episodes","create-episode.html"],["✚","Create","create-podcast.html"],
  ["⌘","Studio","creator-dashboard.html"],["◈","Analytics","analytics.html"],["$","Earnings","creator-payouts.html"]
];
const admin=[
  ["⚙","Admin Center","admin.html"],["✓","Moderation","admin.html?view=moderation"],
  ["⇧","Publishing","publishing-pipeline.html"],["♥","Health","admin.html?view=health"],
  ["◈","Analytics","admin.html?view=analytics"]
];
function isAdmin(u){
 const m=u?.app_metadata||{};
 return m.is_admin===true || m.admin===true || ["admin","administrator","superadmin"].includes(String(m.role||"").toLowerCase()) ||
   Array.isArray(m.roles)&&m.roles.some(r=>["admin","administrator","superadmin"].includes(String(r).toLowerCase()));
}
async function getContext(){
 let client=window.CROW_SUPABASE;
 if(!client&&window.supabase?.createClient&&SUPABASE_KEY){
   try{client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});window.CROW_SUPABASE=client}catch(_){}
 }
 if(!client?.auth?.getSession)return {role:"listener",user:null};
 try{
   const {data}=await client.auth.getSession(), user=data?.session?.user||null;
   if(!user)return {role:"listener",user:null};
   if(isAdmin(user))return {role:"admin",user};
   let creator=false;
   try{
     const q=await client.from("creators").select("id").eq("user_id",user.id).limit(1);
     creator=!q.error&&!!q.data?.length;
   }catch(_){}
   if(!creator){
     try{
       const q=await client.from("creators").select("id").eq("id",user.id).limit(1);
       creator=!q.error&&!!q.data?.length;
     }catch(_){}
   }
   const meta=user.app_metadata||{};
   if(["creator","podcaster"].includes(String(meta.role||"").toLowerCase())||meta.is_creator===true)creator=true;
   return {role:creator?"creator":"listener",user};
 }catch(_){return {role:"listener",user:null}}
}
function link([icon,label,href]){
 const path=href.split("#")[0].split("?")[0], active=here()===path;
 return '<a class="crpv2-link'+(active?' active':'')+'" href="'+href+'"'+(active?' aria-current="page"':'')+'><span class="crpv2-icon" aria-hidden="true">'+icon+'</span><span>'+esc(label)+'</span></a>';
}
function group(title,items){
 return '<div class="crpv2-group"><div class="crpv2-group-title">'+esc(title)+'</div>'+items.map(link).join("")+'</div>';
}
function render(ctx){
 const host=document.querySelector("[data-nav]"); if(!host)return;
 const role=ctx.role, label=role==="admin"?"ADMIN COMMAND":role==="creator"?"CREATOR COMMAND":"LISTENER";
 const roleItems=role==="admin"?admin:role==="creator"?creator:listener;
 host.innerHTML='<div class="crpv2-shell"><div class="crpv2-bar">'+
 '<a class="crpv2-brand" href="home.html"><span class="crpv2-mark">CR</span><span>CROWRULES <b>PODCASTING</b></span></a>'+
 '<nav class="crpv2-desktop" aria-label="CrowRules Podcasting navigation">'+
 '<a class="crpv2-toplink" href="home.html">Home</a><a class="crpv2-toplink" href="podcasts.html">Podcasts</a><a class="crpv2-toplink" href="discover.html">Discover</a>'+
 '<div class="crpv2-dropdown"><button class="crpv2-command" type="button" aria-expanded="false"><span>☰</span>'+label+' <i>⌄</i></button>'+
 '<div class="crpv2-menu" role="menu">'+group("Explore",common.slice(3)).replace("Explore","EXPLORE")+group(role==="admin"?"Administration":role==="creator"?"Creator Workspace":"Your Listening",roleItems)+
 '<div class="crpv2-divider"></div>'+group("Account",[["◎","Library","library.html"],["♙","Profile","member-profile.html"],["⚙","Account","account.html"],["◆","Membership","membership.html"]])+
 '</div></div></nav><button class="crpv2-mobile-toggle" type="button" aria-expanded="false" aria-label="Open Podcasting command center">☰</button></div>'+
 '<div class="crpv2-mobile"><div class="crpv2-mobile-title">CROWRULES PODCASTING · '+label+'</div>'+group("Explore",common)+group(role==="admin"?"Administration":role==="creator"?"Creator Workspace":"Your Listening",roleItems)+group("Account",[["◎","Library","library.html"],["♙","Profile","member-profile.html"],["⚙","Account","account.html"],["◆","Membership","membership.html"]])+'</div></div>';
 const dd=host.querySelector(".crpv2-command"),menu=host.querySelector(".crpv2-menu"),toggle=host.querySelector(".crpv2-mobile-toggle"),mobile=host.querySelector(".crpv2-mobile");
 dd?.addEventListener("click",e=>{e.stopPropagation();const o=menu.classList.toggle("open");dd.setAttribute("aria-expanded",String(o))});
 toggle?.addEventListener("click",()=>{const o=mobile.classList.toggle("open");toggle.setAttribute("aria-expanded",String(o))});
 document.addEventListener("click",e=>{if(!host.contains(e.target)){menu?.classList.remove("open");dd?.setAttribute("aria-expanded","false")}});
 host.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu?.classList.remove("open");mobile?.classList.remove("open")}));
 host.dataset.navVersion=VERSION;
}
function boot(){getContext().then(render)}
const css=document.createElement("style");
css.textContent='.crpv2-shell{position:sticky;top:0;z-index:10000;font-family:Montserrat,system-ui,sans-serif}.crpv2-bar{min-height:64px;padding:9px max(18px,calc((100vw - 1400px)/2));display:flex;align-items:center;gap:24px;background:rgba(5,7,14,.94);border-bottom:1px solid #ffffff14;backdrop-filter:blur(20px);box-shadow:0 8px 35px #0006}.crpv2-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;white-space:nowrap;font:800 .72rem Orbitron,Montserrat}.crpv2-brand b{color:#55e7ff}.crpv2-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid #55e7ff55;border-radius:10px;background:linear-gradient(145deg,#55e7ff16,#a66cff16);color:#55e7ff;font-size:.65rem}.crpv2-desktop{display:flex;align-items:center;gap:6px;margin-left:auto}.crpv2-toplink,.crpv2-command{color:#c7cedd;text-decoration:none;border:1px solid transparent;background:transparent;padding:10px 11px;border-radius:10px;font:700 .67rem Montserrat;cursor:pointer}.crpv2-toplink:hover,.crpv2-command:hover{color:#fff;background:#ffffff08}.crpv2-command{border-color:#ffffff16}.crpv2-command i{font-style:normal;color:#55e7ff;margin-left:4px}.crpv2-dropdown{position:relative}.crpv2-menu{position:absolute;right:0;top:calc(100% + 10px);width:270px;max-height:min(78vh,650px);overflow:auto;padding:10px;background:rgba(8,11,20,.98);border:1px solid #ffffff18;border-radius:16px;box-shadow:0 25px 70px #000b;display:none}.crpv2-menu.open{display:block}.crpv2-group{padding:5px}.crpv2-group-title{padding:7px 9px;color:#55e7ff;font:800 .55rem Orbitron;letter-spacing:.15em;text-transform:uppercase}.crpv2-link{display:flex;align-items:center;gap:9px;padding:9px;border-radius:9px;color:#aeb7ca;text-decoration:none;font-size:.68rem}.crpv2-link:hover,.crpv2-link.active{color:#fff;background:#ffffff09}.crpv2-link.active{box-shadow:inset 2px 0 #55e7ff}.crpv2-icon{width:18px;text-align:center;color:#55e7ff}.crpv2-divider{height:1px;background:#ffffff10;margin:6px 5px}.crpv2-mobile-toggle,.crpv2-mobile{display:none}@media(max-width:760px){.crpv2-desktop{display:none}.crpv2-bar{padding:8px 12px}.crpv2-brand{margin-right:auto}.crpv2-mobile-toggle{display:block;border:1px solid #ffffff18;background:#ffffff08;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}.crpv2-mobile{display:none;padding:10px 12px 15px;background:rgba(8,11,20,.99);border-bottom:1px solid #ffffff14}.crpv2-mobile.open{display:block}.crpv2-mobile .crpv2-group{border-top:1px solid #ffffff08}.crpv2-mobile-title{padding:8px 9px;color:#8f9bb0;font:700 .55rem Orbitron;letter-spacing:.13em}.crpv2-mobile .crpv2-link{padding:11px 10px}}@media(prefers-reduced-motion:reduce){.crpv2-menu,.crpv2-mobile{transition:none}}';
document.head.appendChild(css);
window.addEventListener("crow:auth-changed",()=>setTimeout(boot,0));window.addEventListener("crow:ready",()=>setTimeout(boot,0));if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.CrowRulesPodcastingNavV2={version:VERSION,refresh:boot};
})();