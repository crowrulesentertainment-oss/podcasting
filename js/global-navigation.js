/* CrowRules Podcasting — Canonical Navigation 14.0 */
(()=>{"use strict";if(window.__CROWRULES_NAV_140__)return;window.__CROWRULES_NAV_140__=true;
const BASE="/podcasting/",current=()=>location.pathname.split("/").filter(Boolean).pop()?.toLowerCase()||"home.html";
const items=[
 ["home.html","Home",["home.html"]],
 ["discover.html","Browse",["discover.html","categories.html","search.html"]],
 ["home.html#top-podcasts","Top 10",["top-10.html"]],
 ["episodes.html","Episodes",["episodes.html","episode.html","feed.html"]],
 ["creators.html","Hosts",["creators.html","creator.html"]],
 ["live.html","Live",["live.html"]],
 ["create-podcast.html","Create",["create-podcast.html","upload-episode.html","edit-podcast.html","edit-episode.html"]],
 ["my-library.html","Library",["my-library.html","following.html","listening-history.html","saved.html"]],
 ["membership.html","Membership",["membership.html","billing.html","subscriptions.html"]]
];
function mount(){
 if(document.body.dataset.noNav==="true")return;
 document.querySelectorAll("header:not(.cr-global-header),nav:not(.cr-global-nav)").forEach(e=>e.remove());
 const c=current(),links=items.map(([href,label,aliases])=>'<a href="'+(href.startsWith("#")?href:BASE+href)+'" '+(aliases.includes(c)?"aria-current=\"page\"":"")+'>'+label+"</a>").join("");
 const h=document.createElement("header");h.className="cr-global-header";
 h.innerHTML='<div class="cr-global-inner"><a class="cr-global-brand" href="'+BASE+'home.html"><span class="cr-global-brand-mark">CR</span><span class="cr-global-brand-text">CROWRULES <small>PODCASTING</small></span></a><button class="cr-mobile-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="cr-global-nav" aria-label="Primary">'+links+'</nav><div class="cr-global-actions"><a class="cr-extra" href="'+BASE+'login.html">Login</a><a class="cr-account" href="'+BASE+'account-center.html">Account</a></div></div>';
 document.body.prepend(h);
 const b=h.querySelector(".cr-mobile-toggle"),n=h.querySelector(".cr-global-nav");
 b?.addEventListener("click",()=>{const open=n.classList.toggle("is-open");b.setAttribute("aria-expanded",String(open));b.textContent=open?"×":"☰"});
 new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.("header:not(.cr-global-header),nav:not(.cr-global-nav)"))n.remove();n.querySelectorAll?.("header:not(.cr-global-header),nav:not(.cr-global-nav)").forEach(e=>e.remove())}})).observe(document.body,{childList:true,subtree:true});
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",mount,{once:true}):mount();
})();