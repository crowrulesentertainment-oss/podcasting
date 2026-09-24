/* CrowRules Podcasting — Canonical Global Navigation 13.0
   Repository-wide enforcement:
   Every HTML page gets this script at deployment time.
   Existing headers/navs are removed before one canonical header is mounted.
*/
(()=>{"use strict";if(window.__CROWRULES_NAV_130__)return;window.__CROWRULES_NAV_130__=true;
const BASE="/podcasting/";
const links=[
["index.html","Home",["index.html","home.html"]],
["discover.html","Discover",["discover.html"]],
["search.html","Search",["search.html"]],
["podcasts.html","Podcasts",["podcasts.html","podcast.html","episode.html","episodes.html"]],
["creators.html","Creators",["creators.html","creator-dashboard.html","creator-studio.html","creator-guide.html"]],
["member-hub.html","Member Hub",["member-hub.html","member-profile.html","member-settings.html","members.html"]],
["my-library.html","Library",["my-library.html","my-podcasts.html","my-episodes.html","saved.html","following.html","listening-history.html"]],
["create-podcast.html","Create",["create-podcast.html","upload-episode.html","edit-podcast.html","edit-episode.html"]],
["creator-studio.html","Studio",["creator-studio.html","creator-studio-activity.html","creator-studio-navigation.html","creator-action-center.html"]],
["membership.html","Membership",["membership.html","billing.html","subscriptions.html","subscription-lifecycle.html"]],
];
function current(){return(location.pathname.split("/").filter(Boolean).pop()||"index.html").toLowerCase()}
function mount(){
 document.querySelectorAll("header:not(.cr-global-header),nav:not(.cr-global-nav)").forEach(el=>el.remove());
 document.body.classList.add("cr-has-global-nav");
 const c=current(),nav=links.map(([href,label,aliases])=>'<a href="'+BASE+href+'" '+(aliases.includes(c)?"aria-current=\"page\"":"")+'>'+label+"</a>").join("");
 const h=document.createElement("header");h.className="cr-global-header";
 h.innerHTML='<div class="cr-global-inner"><a class="cr-global-brand" href="'+BASE+'"><span class="cr-global-brand-mark">CR</span><span class="cr-global-brand-text">CROWRULES <small>PODCASTING</small></span></a><button class="cr-mobile-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="cr-global-nav" aria-label="Primary">'+nav+'</nav><div class="cr-global-actions"><a class="cr-extra" href="'+BASE+'login.html">Login</a><a class="cr-account" href="'+BASE+'account-center.html">Account</a></div></div>';
 document.body.prepend(h);\n new MutationObserver(m=>{m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.("header:not(.cr-global-header),nav:not(.cr-global-nav)"))n.remove();n.querySelectorAll?.("header:not(.cr-global-header),nav:not(.cr-global-nav)").forEach(el=>el.remove())}})}).observe(document.body,{childList:true,subtree:true});
 const b=h.querySelector(".cr-mobile-toggle"),n=h.querySelector(".cr-global-nav");
 b.addEventListener("click",()=>{const open=n.classList.toggle("is-open");b.setAttribute("aria-expanded",String(open));b.textContent=open?"×":"☰"});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();