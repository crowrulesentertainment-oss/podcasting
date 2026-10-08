(()=>{"use strict";
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const initials=s=>String(s||"CR").trim().split(/\\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"CR";
function mount(){
 if(document.querySelector("#cr-account-ui"))return;
 const h=document.createElement("header");h.id="cr-account-ui";h.className="cr-account-header";
 h.innerHTML=`<div class="cr-account-inner">
  <a class="cr-account-brand" href="home.html" aria-label="CrowRules Podcasting home"><span class="cr-account-mark">CR</span><span>CROWRULES <b>PODCASTING</b></span></a>
  <nav class="cr-account-links" aria-label="Podcasting account navigation">
   <a href="home.html">Home</a><a href="discover.html">Discover</a>
   <a href="library.html" data-auth-link>Library</a><a href="profile.html" data-auth-link>Profile</a>
   <a href="creator.html" data-creator-link hidden>Creator Studio</a>
  </nav>
  <div class="cr-account-area">
   <a class="cr-account-join" href="signup.html" data-guest>JOIN</a>
   <a class="cr-account-signin" href="login.html" data-guest>SIGN IN</a>
   <button class="cr-account-user" type="button" data-user hidden aria-expanded="false">
    <span class="cr-account-avatar" data-avatar>CR</span><span class="cr-account-usercopy"><strong data-name>Account</strong><small data-membership>FREE</small></span><span class="cr-account-points" data-points>0 CP</span><span class="cr-account-chevron">⌄</span>
   </button>
   <div class="cr-account-menu" data-menu hidden>
    <div class="cr-account-menu-head"><span class="cr-account-avatar large" data-avatar>CR</span><div><strong data-name>Account</strong><small data-email></small></div></div>
    <div class="cr-account-menu-stats"><span><b data-menu-membership>FREE</b>Membership</span><span><b data-menu-points>0</b>CrowPoints</span></div>
    <a href="library.html">♫ My Library</a><a href="profile.html">◎ My Profile</a><a href="creator.html" data-menu-creator hidden>◆ Creator Studio</a>
    <button type="button" data-signout>↪ Sign Out</button>
   </div>
  </div>
 </div>`;
 document.body.prepend(h);
 h.querySelector("[data-user]").addEventListener("click",()=>{const m=h.querySelector("[data-menu]"),b=h.querySelector("[data-user]");m.hidden=!m.hidden;b.setAttribute("aria-expanded",String(!m.hidden));});
 document.addEventListener("click",e=>{if(!h.contains(e.target)){h.querySelector("[data-menu]").hidden=true;h.querySelector("[data-user]").setAttribute("aria-expanded","false");}});
 h.querySelector("[data-signout]").addEventListener("click",async()=>{const sb=window.CROW_PODCASTING;if(!sb?.auth)return;await sb.auth.signOut();location.href="login.html";});
}
function render(s){
 const h=document.querySelector("#cr-account-ui");if(!h)return;
 const signed=!!s?.user, creator=!!s?.creator?.is_active||!!s?.profile?.is_creator;
 const name=s?.profile?.display_name||s?.member?.display_name||s?.member?.username||s?.user?.user_metadata?.full_name||"Account";
 const email=s?.user?.email||"";const avatar=s?.profile?.avatar_url||s?.member?.avatar_url||s?.user?.user_metadata?.avatar_url||"";
 const type=String(s?.membership?.type||"free").replace(/[_-]+/g," ").toUpperCase();
 const points=Number(s?.membership?.points||s?.member?.points||0).toLocaleString();
 h.querySelectorAll("[data-name]").forEach(e=>e.textContent=name);h.querySelector("[data-email]").textContent=email;
 h.querySelectorAll("[data-points]").forEach(e=>e.textContent=points+" CP");
 h.querySelector("[data-membership]").textContent=type;
 h.querySelector("[data-menu-membership]").textContent=type;
 h.querySelector("[data-menu-points]").textContent=points;
 h.querySelectorAll("[data-avatar]").forEach(e=>{e.textContent=initials(name);if(avatar){e.innerHTML='<img src="'+esc(avatar)+'" alt="">'}});
 h.querySelectorAll("[data-guest]").forEach(e=>e.hidden=signed);
 h.querySelector("[data-user]").hidden=!signed;
 h.querySelector("[data-creator-link]").hidden=!creator;
 h.querySelector("[data-menu-creator]").hidden=!creator;
}
function boot(){mount();if(window.CrowAccount?.onChange)window.CrowAccount.onChange(render);else window.addEventListener("crowrules:account",e=>render(e.detail));}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();