(()=>{"use strict";
const VERSION="8.0.0";
const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function inject(tag,attrs={},parent=document.head){const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.appendChild(e);return e}
function toast(message,kind="info"){let t=$("#cr8-toast");if(!t){t=document.createElement("div");t.id="cr8-toast";t.className="cr8-toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");document.body.appendChild(t)}t.dataset.kind=kind;t.textContent=message;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),3200)}
function setupChrome(){
 if(!document.body)return;
 if(!$("#cr8-progress")){const p=document.createElement("div");p.id="cr8-progress";p.className="cr8-progress";p.innerHTML="<i></i>";document.body.appendChild(p)}
 if(!$("#cr8-skip")){const a=document.createElement("a");a.id="cr8-skip";a.className="cr8-skip";a.href="#main";a.textContent="Skip to main content";document.body.prepend(a)}
 const main=$("main");if(main&&!main.id)main.id="main";
 if(!$("#cr8-up")){const b=document.createElement("button");b.id="cr8-up";b.className="cr8-up";b.type="button";b.setAttribute("aria-label","Back to top");b.textContent="↑";b.onclick=()=>scrollTo({top:0,behavior:"smooth"});document.body.appendChild(b)}
 if(!$("#cr8-online")){const n=document.createElement("div");n.id="cr8-online";n.className="cr8-online";n.textContent=navigator.onLine?"NETWORK ONLINE":"OFFLINE MODE";document.body.appendChild(n)}
 if(!$("#cr8-footer")){const f=document.createElement("footer");f.id="cr8-footer";f.className="cr8-footer";f.innerHTML='<div class="cr8-footer-grid"><div><strong>CROWRULES / PODCASTING</strong><br>One account. One universe. Built for listeners, creators and the next generation of independent voices.</div><nav aria-label="Podcasting footer"><a href="home.html">Home</a><a href="discover.html">Discover</a><a href="library.html">Library</a><a href="creator.html">Creator Studio</a><a href="profile.html">Profile</a><a href="login.html">Sign In</a><a href="signup.html">Join</a></nav></div><div style="margin-top:16px">© '+new Date().getFullYear()+' CrowRules Entertainment • Podcasting V'+VERSION+'</div>';document.body.appendChild(f)}
}
function setupAccountUI(){
 const id="cr8-account";
 if(!document.body||document.getElementById(id))return;
 const wrap=document.createElement("div");wrap.id=id;wrap.className="cr8-account";
 wrap.innerHTML='<button class="cr8-account-trigger" type="button" aria-expanded="false"><span class="cr8-account-avatar"><img data-cr-account-avatar alt=""></span><span class="cr8-account-copy"><b data-cr-account-name>Account</b><small data-cr-account-membership>Sign in to Podcasting</small></span><span class="cr8-account-chevron">⌄</span></button><div class="cr8-account-menu" hidden><div class="cr8-account-summary"><strong data-cr-account-name>Account</strong><span data-cr-account-points>CrowPoints: 0</span><span data-cr-account-badge>FREE</span></div><a href="account.html">ACCOUNT DASHBOARD</a><a href="library.html">LIBRARY</a><a href="profile.html">PROFILE</a><a href="creator.html" data-cr-creator-link>CREATOR STUDIO</a><a href="login.html" data-cr-signin>SIGN IN</a><a href="signup.html" data-cr-join>JOIN CROW RULES</a><button type="button" data-cr-signout>SIGN OUT</button></div>';
 document.body.appendChild(wrap);
 const trigger=wrap.querySelector(".cr8-account-trigger"),menu=wrap.querySelector(".cr8-account-menu");
 trigger.onclick=()=>{const open=menu.hidden;menu.hidden=!open;trigger.setAttribute("aria-expanded",String(open))};
 document.addEventListener("click",e=>{if(!wrap.contains(e.target)){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
 wrap.querySelector("[data-cr-signout]").onclick=async()=>{try{await window.CROW_PODCASTING?.auth.signOut();toast("Signed out.");}catch(e){toast("Sign out failed.","error")}};
 const update=state=>{
  const signed=!!state?.user, creator=!!(state?.creator?.is_active||state?.profile?.is_creator), member=state?.membership;
  const name=state?.profile?.display_name||state?.member?.display_name||state?.user?.user_metadata?.full_name||state?.user?.email?.split("@")[0]||"Account";
  const avatar=state?.profile?.avatar_url||state?.member?.avatar_url||state?.user?.user_metadata?.avatar_url||"";
  wrap.querySelectorAll("[data-cr-account-name]").forEach(e=>e.textContent=name);
  wrap.querySelector("[data-cr-account-membership]").textContent=signed?(member?.type||"free").toUpperCase()+" MEMBER":"Sign in to Podcasting";
  wrap.querySelector("[data-cr-account-points]").textContent="CrowPoints: "+Number(member?.points||0).toLocaleString();
  wrap.querySelector("[data-cr-account-badge]").textContent=(member?.type||"free").toUpperCase();
  const img=wrap.querySelector("[data-cr-account-avatar] img");if(avatar){img.src=avatar;img.style.display="block"}else{img.removeAttribute("src");img.style.display="none"}
  wrap.querySelector("[data-cr-signin]").hidden=signed;wrap.querySelector("[data-cr-join]").hidden=signed;wrap.querySelector("[data-cr-signout]").hidden=!signed;wrap.querySelector("[data-cr-creator-link]").hidden=!creator;
 };
 if(window.CrowAccount?.onChange)window.CrowAccount.onChange(update);else window.addEventListener("crowrules:account",e=>update(e.detail));
}
function setupProgress(){
 const bar=$("#cr8-progress i");if(!bar)return;
 const update=()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?Math.min(100,scrollY/max*100):0)+"%";$("#cr8-up")?.classList.toggle("show",scrollY>700)};
 addEventListener("scroll",update,{passive:true});addEventListener("resize",update,{passive:true});update();
}
function setupNav(){
 const here=(location.pathname.split("/").pop()||"home.html").toLowerCase();
 $$("a[href]").forEach(a=>{try{const u=new URL(a.href,location.href);const p=(u.pathname.split("/").pop()||"home.html").toLowerCase();if(p===here&&!a.href.includes("#"))a.classList.add("cr8-nav-active")}catch(_){}});
 document.addEventListener("keydown",e=>{if(e.key!=="/"||e.ctrlKey||e.metaKey||e.altKey)return;if(/input|textarea|select/i.test(e.target.tagName))return;const q=$('input[type="search"],input[placeholder*="Search" i],#search');if(q){e.preventDefault();q.focus()}});
}
function setupNetwork(){const n=$("#cr8-online");if(!n)return;const set=()=>{n.textContent=navigator.onLine?"NETWORK ONLINE":"OFFLINE MODE";n.classList.toggle("cr8-offline",!navigator.onLine)};addEventListener("online",()=>{set();toast("Connection restored.")});addEventListener("offline",()=>{set();toast("You're offline. Saved local playback controls remain available.","error")});set()}
function setupLinks(){
 document.addEventListener("click",e=>{
  const a=e.target.closest("a[href]");if(!a||a.target==="_blank"||a.hasAttribute("download"))return;
  let u;try{u=new URL(a.href,location.href)}catch(_){return}
  if(u.origin!==location.origin)return;
  const next=u.pathname.split("/").pop()||"home.html";
  if(next==="login.html"||next==="signup.html")return;
  try{sessionStorage.setItem("crp_last_page",location.href)}catch(_){}
 });
}
function setupAuthUX(){
 const update=(state)=>{
  document.documentElement.dataset.crSignedIn=state?.user?"true":"false";
  document.documentElement.dataset.crCreator=state?.creator?.is_active||state?.profile?.is_creator?"true":"false";
  document.documentElement.dataset.crMembership=String(state?.membership?.type||"free");
  document.querySelectorAll("[data-cr-account-name]").forEach(e=>e.textContent=state?.profile?.display_name||state?.member?.display_name||state?.user?.user_metadata?.full_name||"Account");
  document.querySelectorAll("[data-cr-account-avatar]").forEach(e=>{const u=state?.profile?.avatar_url||state?.member?.avatar_url||state?.user?.user_metadata?.avatar_url;if(u)e.src=u;});
 };
 if(window.CrowAccount?.onChange) window.CrowAccount.onChange(update);
 else window.addEventListener("crowrules:account",e=>update(e.detail));
 window.addEventListener("crowrules:auth",e=>{
  const next=new URLSearchParams(location.search).get("next");
  if(e.detail?.event==="SIGNED_IN"&&next&&/^[A-Za-z0-9_./?=&-]+\.html(?:[?#].*)?$/.test(next)&&!location.pathname.endsWith(next.split("?")[0].split("#")[0])) location.href=next;
 });
}
function setupTheme(){document.body.dataset.crPodcastingVersion=VERSION;try{localStorage.setItem("crp_site_version",VERSION)}catch(_){}}
function setupServiceLinks(){
 const manifest=location.pathname.includes("/podcasting/")?"manifest.json":null;
 if(manifest&&!document.querySelector('link[rel="manifest"]'))inject("link",{rel:"manifest",href:manifest});
}
function boot(){setupChrome();setupAccountUI();setupProgress();setupNav();setupNetwork();setupLinks();setupAuthUX();setupTheme();setupServiceLinks();root.dataset.crPodcasting="v8";window.CrowPodcastingV8={version:VERSION,toast};}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();