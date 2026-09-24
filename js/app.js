/* CrowRules Podcasting — Universal Application Engine 10.0
   One platform shell. Supabase-native. Stripe via Edge Functions.
   Navigation is owned exclusively by js/global-navigation.js.
*/
(()=>{"use strict";
if(window.__CROWRULES_APP_100__)return;
window.__CROWRULES_APP_100__=true;

const C=window.CROW_CONFIG||{};
const SUPABASE_URL=C.supabaseUrl||window.CROWRULES_SUPABASE_URL||"https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY=C.supabaseKey||window.CROWRULES_SUPABASE_PUBLISHABLE_KEY||"";
const SITE=(C.siteUrl||"https://crowrulesentertainment-oss.github.io/podcasting/").replace(/\/$/,"");
const S=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
window.CrowRules=window.CrowRules||{};
window.CrowRules.supabase=S;
window.CrowRules.config=C;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const file=()=>location.pathname.split("/").filter(Boolean).pop()?.toLowerCase()||"home.html";
const nextUrl=()=>encodeURIComponent(location.pathname.split("/").pop()+location.search+location.hash);

function requireDb(){
 if(!S)throw new Error("CrowRules data service is not available.");
 return S;
}
async function user(){
 const db=requireDb(),r=await db.auth.getSession();
 return r.data?.session?.user||null;
}
async function need(){
 const u=await user();
 if(!u){location.href="login.html?next="+nextUrl();return null}
 return u;
}
function artwork(url,cls="art"){
 return url?'<img class="'+cls+'" src="'+esc(url)+'" alt="" loading="lazy">':'<div class="'+cls+' placeholder-art" aria-hidden="true">CR</div>';
}
function showUrl(id){return "podcast.html?id="+encodeURIComponent(id)}
function loginUrl(){return "login.html?next="+nextUrl()}

async function isFollowing(id,u){
 if(!u)return false;
 const r=await requireDb().from("podcast_follows").select("id").eq("user_id",u.id).eq("podcast_id",id).maybeSingle();
 return !!r.data&&!r.error;
}
async function toggleFollow(id,button,status){
 const u=await need();if(!u)return;
 const db=requireDb();
 const following=button.getAttribute("aria-pressed")==="true";
 button.disabled=true;
 if(status)status.textContent=following?"Removing…":"Subscribing…";
 const rpc=following?"unfollow_my_podcast":"follow_my_podcast";
 const r=await db.rpc(rpc,{p_podcast_id:id});
 if(r.error){
   button.disabled=false;
   if(status)status.textContent=r.error.message;
   return;
 }
 const on=!following;
 button.setAttribute("aria-pressed",String(on));
 button.classList.toggle("is-following",on);
 button.textContent=on?"Subscribed ✓":"Subscribe to Show";
 if(status)status.textContent=on?"Added to your Library.":"Removed from your Library.";
 button.disabled=false;
}
function followButton(id,following=false){
 return '<button type="button" class="directory-follow follow-directory '+(following?"is-following":"")+'" data-follow="'+esc(id)+'" aria-pressed="'+String(following)+'">'+(following?"Subscribed ✓":"Subscribe to Show")+'</button>';
}
function wireFollowButtons(root=document){
 $$(".follow-directory,[data-follow]",root).forEach(btn=>{
   if(btn.dataset.followBound)return;
   btn.dataset.followBound="1";
   btn.addEventListener("click",async e=>{
     e.preventDefault();e.stopPropagation();
     const status=btn.parentElement?.querySelector("[data-follow-status]");
     await toggleFollow(btn.dataset.follow,btn,status);
   });
 });
}

function card(p,following=false){
 return '<article class="card podcast-card">'+
   artwork(p.artwork_url,"art")+
   '<span class="pill">'+esc(p.category||"Podcast")+'</span>'+
   '<h3>'+esc(p.title||"Untitled Podcast")+'</h3>'+
   '<p>'+esc(p.description||"")+'</p>'+
   '<div class="actions"><a class="btn" href="'+showUrl(p.id)+'">Open Show</a>'+followButton(p.id,following)+'</div>'+
   '<span class="muted" data-follow-status></span></article>';
}

async function loadShows(){
 const b=$("#podcastGrid");if(!b||!S)return;
 const r=await S.from("podcasts").select("id,title,category,description,artwork_url,is_featured,created_at,status").order("is_featured",{ascending:false}).order("created_at",{ascending:false}).limit(24);
 if(r.error){b.innerHTML='<div class="notice">'+esc(r.error.message)+'</div>';return}
 const data=r.data||[];
 let followed=new Set();
 try{
   const u=await user();
   if(u&&data.length){
     const fr=await S.from("podcast_follows").select("podcast_id").eq("user_id",u.id).in("podcast_id",data.map(x=>x.id));
     if(!fr.error)followed=new Set((fr.data||[]).map(x=>x.podcast_id));
   }
 }catch(_){}
 b.innerHTML=data.length?data.map(p=>card(p,followed.has(p.id))).join(""):'<div class="empty">No podcasts published yet.</div>';
 wireFollowButtons(b);
}

async function loadCreators(){
 const b=$("#creatorGrid");if(!b||!S)return;
 const r=await S.from("creators").select("id,name,role,discipline,bio").eq("is_active",true).order("sort_order").limit(24);
 b.innerHTML=r.error?'<div class="notice">'+esc(r.error.message)+'</div>':r.data?.length?r.data.map(c=>'<article class="card"><span class="pill">'+esc(c.role||c.discipline||"Creator")+'</span><h3>'+esc(c.name)+'</h3><p>'+esc(c.bio||"")+'</p><a class="btn" href="creator.html?id='+c.id+'">View Creator</a></article>').join(""):'<div class="empty">No creators published yet.</div>';
}

async function detail(){
 const b=$("#podcastDetail");if(!b||!S)return;
 const id=new URLSearchParams(location.search).get("id");
 if(!id){b.innerHTML='<div class="empty">Select a podcast first.</div>';return}
 const p=await S.from("podcasts").select("*").eq("id",id).maybeSingle();
 if(p.error||!p.data){b.innerHTML='<div class="notice">Podcast not found.</div>';return}
 const e=await S.from("episodes").select("id,title,description,audio_url,episode_number,season_number").eq("show_id",id).eq("is_published",true).order("season_number",{ascending:false}).order("episode_number",{ascending:false});
 const u=await user();const following=await isFollowing(id,u);
 const eps=e.data||[];
 b.innerHTML='<section class="hero"><div><span class="pill">'+esc(p.data.category||"Podcast")+'</span><h1>'+esc(p.data.title)+'</h1><p>'+esc(p.data.description||"")+'</p><div class="actions"><button class="btn primary" id="subscribe" aria-pressed="'+String(following)+'">'+(following?"Subscribed ✓":"Subscribe to Show")+'</button><a class="btn" href="my-library.html">My Library</a><span id="subscribeStatus" class="muted"></span></div></div>'+artwork(p.data.artwork_url,"art")+'</section><section class="section"><h2>Episodes</h2><div class="grid">'+(eps.length?eps.map(x=>'<article class="card"><span class="pill">S'+(x.season_number||1)+' · E'+(x.episode_number||"")+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description||"")+'</p>'+(x.audio_url?'<audio controls preload="none" src="'+esc(x.audio_url)+'" style="width:100%"></audio>':"")+'</article>').join(""):'<div class="empty">No published episodes yet.</div>')+'</div></section>';
 $("#subscribe")?.addEventListener("click",()=>toggleFollow(id,$("#subscribe"),$("#subscribeStatus")));
}

async function account(){
 const b=$("#account");if(!b||!S)return;
 const u=await user();
 if(!u){b.innerHTML='<div class="notice">Not signed in. <a href="login.html">Login</a></div>';return}
 const m=await S.from("members").select("*").eq("user_id",u.id).maybeSingle();
 b.innerHTML='<div class="card"><span class="pill">Signed in</span><h2>'+esc(m.data?.display_name||u.email)+'</h2><p class="muted">'+esc(u.email)+'</p><div class="row"><span>Membership</span><strong>'+esc(m.data?.membership_type||"CROW")+'</strong></div><div class="row"><span>CrowPoints</span><strong>'+Number(m.data?.points||0)+'</strong></div><div class="actions"><a class="btn primary" href="creator-studio.html">Creator Studio</a><a class="btn" href="my-library.html">My Library</a><button class="btn" id="logout">Sign Out</button></div></div>';
 $("#logout")?.addEventListener("click",async()=>{await S.auth.signOut();location.href="login.html"});
}

async function auth(){
 if(!S)return;
 const lf=$("#loginForm");
 if(lf)lf.onsubmit=async e=>{
   e.preventDefault();
   const r=await S.auth.signInWithPassword({email:$("#email")?.value,password:$("#password")?.value});
   const out=$("#loginStatus");if(out)out.textContent=r.error?r.error.message:"";
   if(!r.error)location.href=new URLSearchParams(location.search).get("next")||"home.html";
 };
 $("#google")?.addEventListener("click",async()=>{
   const r=await S.auth.signInWithOAuth({provider:"google",options:{redirectTo:SITE+"/home.html"}});
   if(r.error&&$("#loginStatus"))$("#loginStatus").textContent=r.error.message;
 });
 const sf=$("#signupForm");
 if(sf)sf.onsubmit=async e=>{
   e.preventDefault();
   const r=await S.auth.signUp({email:$("#email")?.value,password:$("#password")?.value,options:{data:{display_name:$("#name")?.value||""}}});
   const out=$("#signupStatus");if(out)out.textContent=r.error?r.error.message:(r.data.session?"Account created.":"Check your email to confirm your account.");
 };
}

async function plans(){
 const b=$("#planGrid");if(!b||!S)return;
 const r=await S.from("membership_plans").select("plan_key,name,price_cents,billing_interval,description,features,is_featured").eq("is_active",true).order("sort_order");
 if(r.error){b.innerHTML='<div class="notice">'+esc(r.error.message)+'</div>';return}
 b.innerHTML=(r.data||[]).map(p=>'<article class="card plan"><span class="pill">'+esc(p.name)+'</span><div class="price">'+(p.price_cents?"$"+(p.price_cents/100).toFixed(2):"FREE")+' <small class="muted">/'+esc(p.billing_interval||"once")+'</small></div><p>'+esc(p.description||"")+'</p><ul>'+((p.features||[]).map(x=>"<li>"+esc(x)+"</li>").join(""))+'</ul><button class="btn '+(p.is_featured?"primary":"")+'" data-plan="'+esc(p.plan_key)+'">'+(p.price_cents?"Join "+esc(p.name):"Join Free")+'</button></article>').join("")||'<div class="empty">Membership plans unavailable.</div>';
 $$("[data-plan]",b).forEach(x=>x.onclick=async()=>{
   const u=await need();if(!u)return;
   if(x.dataset.plan==="crow"){location.href="member-hub.html";return}
   const r=await S.functions.invoke("membership-checkout",{body:{plan_key:x.dataset.plan,success_url:SITE+"/membership.html?checkout=success",cancel_url:SITE+"/membership.html?checkout=cancelled"}});
   if(r.data?.url)location.href=r.data.url;else alert(r.error?.message||r.data?.error||"Checkout unavailable");
 });
}

async function studio(){
 const root=$("#studio");if(!root||!S)return;
 const u=await need();if(!u)return;
 root.innerHTML='<div class="notice">Loading Creator Studio…</div>';
 const m=await S.from("members").select("id,display_name").eq("user_id",u.id).maybeSingle();
 if(m.error||!m.data){root.innerHTML='<div class="notice">'+esc(m.error?.message||"Member profile required.")+'</div>';return}
 const c=await S.from("creators").select("id,name").eq("member_id",m.data.id).eq("is_active",true).maybeSingle();
 if(c.error||!c.data){root.innerHTML='<div class="notice">No active creator profile is connected to this account.</div>';return}
 const all=await S.from("podcasts").select("*").eq("creator_id",c.data.id).order("created_at",{ascending:false});
 if(all.error){root.innerHTML='<div class="notice">'+esc(all.error.message)+'</div>';return}
 const ids=(all.data||[]).map(x=>x.id);let ep=[];
 if(ids.length){const er=await S.from("episodes").select("*").in("show_id",ids).order("created_at",{ascending:false});if(!er.error)ep=er.data||[]}
 root.innerHTML='<section class="section" style="padding-top:35px"><div class="section-head"><div><span class="kicker">CREATOR STUDIO</span><h1>'+esc(c.data.name||"Creator")+'</h1><p class="muted">Your podcasts, episodes, audience and monetization in one workspace.</p></div><a class="btn primary" href="create-podcast.html">+ New Podcast</a></div><div class="grid">'+((all.data||[]).map(p=>'<article class="card"><span class="pill">'+esc(p.status||"draft")+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.description||"No description yet.")+'</p><p class="muted">'+ep.filter(e=>e.show_id===p.id).length+' episodes · '+Number(p.total_plays||0)+' plays</p><a class="btn primary" href="creator-studio.html?id='+encodeURIComponent(p.id)+'">Open Studio</a></article>').join("")||'<div class="empty">No podcasts yet. Create your first show.</div>')+'</div></section>';
}

async function create(){
 const f=$("#createForm");if(!f||!S)return;
 const u=await need();if(!u)return;
 f.onsubmit=async e=>{
   e.preventDefault();
   const val=id=>$("#"+id)?.value?.trim()||"";
   const m=await S.from("members").select("id").eq("user_id",u.id).maybeSingle();
   if(!m.data){$("#createStatus").textContent="Membership profile required.";return}
   let c=await S.from("creators").select("id").eq("member_id",m.data.id).eq("is_active",true).maybeSingle();
   if(!c.data){
     const name=val("creatorName")||val("name")||"New Creator";
     const n=await S.from("creators").insert({member_id:m.data.id,name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),is_active:true}).select("id").single();
     if(n.error){$("#createStatus").textContent=n.error.message;return} c.data=n.data;
   }
   const title=val("title")||"Untitled Podcast";
   const p=await S.from("podcasts").insert({creator_id:c.data.id,title,slug:title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),category:val("category"),description:val("description"),status:"draft"}).select("id").single();
   $("#createStatus").textContent=p.error?p.error.message:"Podcast created.";
   if(p.data)location.href="creator-studio.html?id="+encodeURIComponent(p.data.id);
 };
}

async function connect(){
 const b=$("#connectStripe");if(!b||!S)return;
 b.onclick=async()=>{
   const u=await need();if(!u)return;
   const r=await S.functions.invoke("creator-connect-onboarding",{body:{origin:location.origin,return_path:"/podcasting/payout-center.html"}});
   if(r.data?.onboarding_url)location.href=r.data.onboarding_url;else if($("#stripeStatus"))$("#stripeStatus").textContent=r.error?.message||r.data?.error||"Unable to start Stripe onboarding.";
 };
}

async function payout(){
 const b=$("#payoutStatus");if(!b||!S)return;
 const u=await need();if(!u)return;
 const r=await S.functions.invoke("creator-connect-status",{body:{}});
 b.innerHTML=r.error?'<div class="notice">'+esc(r.error.message)+'</div>':'<div class="row"><span>Onboarding</span><strong>'+esc(r.data?.onboarding_status||"pending")+'</strong></div><div class="row"><span>Charges</span><strong>'+((r.data?.charges_enabled)?"Enabled":"Not enabled")+'</strong></div><div class="row"><span>Payouts</span><strong>'+((r.data?.payouts_enabled)?"Enabled":"Not enabled")+'</strong></div>';
}

async function library(){
 const b=$("#libraryGrid");if(!b||!S)return;
 const u=await user();if(!u){b.innerHTML='<div class="notice">Sign in to view your subscribed shows.</div>';return}
 const r=await S.rpc("get_my_podcast_following");
 if(r.error){b.innerHTML='<div class="notice">'+esc(r.error.message)+'</div>';return}
 const rows=r.data||[];
 b.innerHTML=rows.length?rows.map(x=>{
   const p=x.podcast||x;
   return '<article class="card"><h3>'+esc(p.title||x.title||"Podcast")+'</h3><p>'+esc(p.description||x.description||"")+'</p><a class="btn" href="'+showUrl(p.id||x.podcast_id)+'">Open Show</a></article>';
 }).join(""):'<div class="empty">You have not subscribed to any podcasts yet.</div>';
}

async function boot(){
 if(!S){console.warn("CrowRules: Supabase client unavailable");return}
 await Promise.allSettled([loadShows(),loadCreators(),detail(),account(),auth(),plans(),studio(),create(),connect(),payout(),library()]);
 wireFollowButtons();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();