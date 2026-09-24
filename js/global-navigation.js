(()=>{"use strict";if(window.__CROWRULES_NAV_150__)return;window.__CROWRULES_NAV_150__=true;
const BASE="/podcasting/",file=location.pathname.split("/").filter(Boolean).pop()?.toLowerCase()||"home.html";
if(file==="index.html"||file==="launch.html")return;
const $=(s,r=document)=>r.querySelector(s);
function mount(){
 document.body.classList.add("cr-cinematic");
 if(!document.querySelector(".cr-page-glow"))document.body.insertAdjacentHTML("afterbegin",'<div class="cr-page-glow" aria-hidden="true"></div><div class="cr-scanline" aria-hidden="true"></div>');
 document.querySelectorAll("header:not(.cr-global-header),nav:not(.cr-global-nav)").forEach(e=>e.remove());
 const items=[
  ["home.html","Home",["home.html"]],
  ["discover.html","Discover",["discover.html","categories.html","search.html"]],
  ["rankings.html","Top 10",["rankings.html"]],
  ["episodes.html","Episodes",["episodes.html","episode.html","feed.html"]],
  ["creators.html","Creators",["creators.html","creator.html"]],
  ["live.html","Live",["live.html"]],
  ["my-library.html","Library",["my-library.html","following.html","listening-history.html","saved.html"]],
  ["membership.html","Membership",["membership.html","billing.html","subscriptions.html"]]
 ];
 const current=file;
 const links=items.map(([href,label,aliases])=>'<a href="'+BASE+href+'" '+(aliases.includes(current)?"aria-current=\"page\"":"")+'>'+label+'</a>').join("");
 const h=document.createElement("header");h.className="cr-global-header";
 h.innerHTML='<div class="cr-global-inner"><a class="cr-global-brand" href="'+BASE+'home.html"><span class="cr-global-brand-mark">CR</span><span class="cr-global-brand-text">CROWRULES <small>PODCASTING</small></span></a><button class="cr-mobile-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="cr-global-nav" aria-label="Primary">'+links+'</nav><div class="cr-global-actions"><a class="cr-create cr-extra" href="'+BASE+'create-podcast.html">Create Podcast</a><a class="cr-create cr-extra" href="'+BASE+'upload-episode.html">Create Episode</a><a class="cr-member" href="'+BASE+'membership.html">Membership</a><a class="cr-account" href="'+BASE+'account-center.html">Account</a></div></div>';
 document.body.prepend(h);
 const b=$(".cr-mobile-toggle",h),n=$(".cr-global-nav",h);
 b?.addEventListener("click",()=>{const open=n.classList.toggle("is-open");b.setAttribute("aria-expanded",String(open));b.textContent=open?"×":"☰"});
 window.addEventListener("crowrules:services-ready",()=>{document.dispatchEvent(new CustomEvent("crowrules:navigation-ready"))},{once:true});
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",mount,{once:true}):mount();
})();