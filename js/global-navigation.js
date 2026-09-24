/* CrowRules Podcasting — Global Navigation 8.2
   Real-time identity synchronization: auth, membership, creator, notifications and premium. */
(()=>{"use strict";
if(window.__CROWRULES_GLOBAL_NAV_82__)return;window.__CROWRULES_GLOBAL_NAV_82__=1;
const U=window.CROWRULES_SUPABASE_URL||"https://cevylpnoexugwgygvtgu.supabase.co",K=window.CROWRULES_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_AdfM5y6RqF3tbvEVzDZSg_JuGTQLD-",S={db:null,user:null,membership:false,premium:false,creator:false,unread:0,name:"Account",ready:false};
const nav=[["home.html","Home",["index.html","home.html"],"home"],["discover.html","Discover",["discover.html","search.html","categories.html"],"discover"],["podcasts.html","Podcasts",["podcasts.html","podcast.html"],"listen"],["episodes.html","Episodes",["episodes.html","episode.html"],"listen"],["creators.html","Creators",["creators.html","creator.html"],"discover"],["create-podcast.html","Create",["create-podcast.html"],"create"],["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html"],"create"],["membership.html","Membership",["membership.html","subscriptions.html"],"account"],["premium-library.html","Premium",["premium-library.html","premium.html"],"listen"],["creator-monetization-hub.html","Monetization",["creator-monetization-hub.html","monetization.html"],"growth"],["playback-security.html","Security",["playback-security.html","playback-devices.html"],"account"]],help=["help-center.html","help.html","support.html"],accounts=["profile.html","account.html","account-center.html","account-settings.html"];
const parts=location.pathname.split("/").filter(Boolean),file=/\/[^/]+\.[^/]+$/.test(location.pathname),cur=(file?(parts.pop()||"index.html"):"index.html").toLowerCase(),pre=file&&parts.length?"../".repeat(parts.length):"",href=x=>pre+x,current=x=>x.includes(cur);
let bc=null,channels=[],timer=0;
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function signal(reason){const d={source:"cr-nav-82",reason,userId:S.user?.id||null,at:Date.now()};window.dispatchEvent(new CustomEvent("crowrules:global-navigation-state",{detail:d}));try{bc?.postMessage(d);localStorage.setItem("cr-nav-82",JSON.stringify(d));localStorage.removeItem("cr-nav-82")}catch(_){}}
function build(){
 document.querySelectorAll(".cr-global-header").forEach((x,i)=>i&&x.remove());document.querySelectorAll("[data-cr-global-navigation],[data-crowrules-nav],.cr-nav").forEach(x=>x.remove());if(document.querySelector(".cr-global-header"))return;
 const h=document.createElement("header");h.className="cr-global-header";h.setAttribute("role","banner");
 const inner=document.createElement("div");inner.className="cr-global-inner";
 const brand=document.createElement("a");brand.className="cr-global-brand";brand.href=href("home.html");brand.setAttribute("aria-label","CrowRules Podcasting home");brand.innerHTML='<span class="cr-global-brand-mark" aria-hidden="true">CR</span><span>CrowRules Podcasting</span>';inner.append(brand);
 const desktop=document.createElement("nav"),mobile=document.createElement("nav");desktop.className="cr-global-nav";mobile.className="cr-global-mobile";desktop.setAttribute("aria-label","Primary");mobile.setAttribute("aria-label","Mobile primary");mobile.id="cr-global-mobile-nav";
 const add=(p,t,l,a,g)=>{const x=document.createElement("a");x.href=href(t);x.textContent=l;x.dataset.navGroup=g;if(t==="premium-library.html")x.dataset.navPremium=1;if(t==="creator-studio.html")x.dataset.navCreator=1;if(current(a))x.setAttribute("aria-current","page");p.append(x)};
 nav.forEach(x=>{add(desktop,...x);add(mobile,...x)});add(desktop,"help-center.html","Help",help,"account");add(mobile,"help-center.html","Help",help,"account");
 [["desktop",desktop],["mobile",mobile]].forEach(([_,p])=>{const x=document.createElement("a");x.className="cr-github-link";x.href="https://github.com/crowrulesentertainment-oss/podcasting";x.target="_blank";x.rel="noopener noreferrer";x.textContent="GitHub Repository";x.setAttribute("aria-label","Open the CrowRules Podcasting GitHub repository (opens in a new tab)");p.append(x)});
 const actions=document.createElement("div");actions.className="cr-global-actions";
 const account=document.createElement("a");account.className="cr-profile-link";account.href=href("login.html");account.textContent="Sign In";account.setAttribute("aria-expanded","false");actions.append(account);
 const live=document.createElement("span");live.className="cr-nav-live-indicator";live.textContent="SYNCING";live.setAttribute("aria-label","Identity synchronization status");actions.append(live);
 const btn=document.createElement("button");btn.className="cr-global-menu";btn.type="button";btn.textContent="☰";btn.setAttribute("aria-label","Open navigation");btn.setAttribute("aria-expanded","false");btn.setAttribute("aria-controls",mobile.id);
 const menu=document.createElement("div");menu.className="cr-account-menu";document.body.append(menu);
 inner.append(desktop,actions,btn);h.append(inner,mobile);document.body.insertBefore(h,document.body.firstChild);
 btn.onclick=()=>{const o=mobile.classList.toggle("open");btn.setAttribute("aria-expanded",o);btn.textContent=o?"✕":"☰"};
 mobile.onclick=e=>{if(e.target.closest("a")){mobile.classList.remove("open");btn.setAttribute("aria-expanded","false");btn.textContent="☰"}};
 document.addEventListener("click",e=>{if(!e.target.closest(".cr-profile-link,.cr-account-menu")){menu.classList.remove("open");account.setAttribute("aria-expanded","false")}});
 account.onclick=e=>{if(!S.user)return; e.preventDefault();menu.classList.toggle("open");account.setAttribute("aria-expanded",menu.classList.contains("open"));};
 window.addEventListener("resize",()=>{if(innerWidth>1040){mobile.classList.remove("open");btn.setAttribute("aria-expanded","false");btn.textContent="☰"}},{passive:true});
 window.__crNavRender=()=>{const tags=[S.membership&&"Member",S.creator&&"Creator",S.premium&&"Premium"].filter(Boolean);account.href=href(S.user?"profile.html":"login.html");account.textContent=S.user?(S.name+(tags.length?" · "+tags.join(" · "):"")):"Sign In";account.querySelectorAll(".cr-nav-badge").forEach(x=>x.remove());account.classList.toggle("is-member",S.membership);account.classList.toggle("is-creator",S.creator);account.classList.toggle("is-premium",S.premium);if(S.unread)account.insertAdjacentHTML("beforeend",'<span class="cr-nav-badge" aria-label="'+S.unread+' unread notifications">'+(S.unread>99?"99+":S.unread)+"</span>");live.textContent=S.ready?(S.user?"SYNCED":"GUEST"):"SYNCING";
 menu.innerHTML=S.user?'<div class="cr-account-menu-head"><strong>'+esc(S.name)+'</strong><span>'+esc(S.user.email)+'</span><div class="cr-account-tags">'+(S.membership?'<span class="cr-account-tag member">MEMBER</span>':"")+(S.creator?'<span class="cr-account-tag creator">CREATOR</span>':"")+(S.premium?'<span class="cr-account-tag premium">PREMIUM</span>':"")+'</div></div><a href="'+href("profile.html")+'">Profile</a><a href="'+href("my-library.html")+'">My Library</a><a href="'+href("membership.html")+'">Membership</a><a href="'+href("premium-library.html")+'">Premium Library</a>'+(S.creator?'<a href="'+href("creator-studio.html")+'">Creator Studio</a>':"")+'<a href="'+href("notifications.html")+'">Notifications'+(S.unread?' <span class="cr-nav-badge">'+S.unread+"</span>":"")+'</a><a href="'+href("account-settings.html")+'">Account Settings</a><button type="button" data-nav-signout>Sign Out</button>':'<div class="cr-account-menu-head"><strong>Welcome to CrowRules</strong><span>One Account. One Universe.</span></div><a href="'+href("login.html")+'">Sign In</a><a href="'+href("signup.html")+'">Create Account</a>';
 menu.querySelector("[data-nav-signout]")?.addEventListener("click",()=>S.db?.auth.signOut());
 };
 window.__crNavRender();
}
async function dep(){if(window.supabase?.createClient)return;await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=ok;s.onerror=no;document.head.append(s)})}
async function sync(reason="sync"){
 if(!S.db)S.db=window.CrowRulesMemberState?.client||window.supabase?.createClient(U,K);if(!S.db)return;
 const {data:{session}}=await S.db.auth.getSession();S.user=session?.user||null;
 if(!S.user){S.membership=S.premium=S.creator=false;S.unread=0;S.name="Account";S.ready=true;window.__crNavRender?.();signal(reason);return}
 const id=S.user.id;
 const [p,m,e,n,c]=await Promise.all([
  S.db.from("podcast_member_profiles").select("display_name,username").eq("user_id",id).maybeSingle(),
  S.db.from("membership_subscriptions").select("status,current_period_end").eq("user_id",id).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  S.db.from("cr_podcast_entitlements").select("status,ends_at").eq("member_user_id",id).in("status",["active","past_due"]).limit(20),
  S.db.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",id).eq("is_read",false),
  S.db.from("creators").select("id,name").eq("member_id",id).eq("is_active",true).maybeSingle()
 ]);
 S.name=p.data?.display_name||p.data?.username||c.data?.name||S.user.email?.split("@")[0]||"Member";
 S.membership=["active","trialing","past_due"].includes(String(m.data?.status||"").toLowerCase());
 S.premium=(e.data||[]).some(x=>x.status==="active"&&(!x.ends_at||new Date(x.ends_at)>new Date()));
 S.creator=!!c.data;S.unread=n.count||0;S.ready=true;window.__crNavRender?.();signal(reason);
}
function realtime(){
 if(!S.db||!S.user)return;channels.forEach(x=>S.db.removeChannel(x));channels=[];const id=S.user.id,refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>sync("realtime-change"),150)};
 [["membership_subscriptions","user_id"],["podcast_notifications","user_id"],["cr_podcast_entitlements","member_user_id"],["podcast_member_profiles","user_id"],["creators","member_id"]].forEach(([table,col])=>{const ch=S.db.channel("cr-nav-82-"+table+"-"+id.slice(0,8)).on("postgres_changes",{event:"*",schema:"public",table,filter:col+"=eq."+id},refresh).subscribe();channels.push(ch)});
}
async function start(){build();try{await dep();S.db=S.db||window.CrowRulesMemberState?.client||window.supabase?.createClient(U,K);if(!S.db)return;S.db.auth.onAuthStateChange(async(e)=>{await sync(e);realtime()});await sync("initial");realtime();window.addEventListener("focus",()=>sync("focus"));document.addEventListener("visibilitychange",()=>!document.hidden&&sync("visibility"))}catch(e){S.ready=true;window.__crNavRender?.();signal("error")}}
try{bc=new BroadcastChannel("crowrules-global-identity-82");bc.onmessage=e=>e.data?.source==="cr-nav-82"&&sync("cross-tab")}catch(_){}
window.addEventListener("storage",e=>e.key==="cr-nav-82"&&sync("storage-sync"));
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();