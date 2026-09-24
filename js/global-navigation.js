/* CrowRules Podcasting — Canonical Global Navigation 12.0 */
(()=>{"use strict";if(window.__CROWRULES_NAV_120__)return;window.__CROWRULES_NAV_120__=true;
const BASE="/podcasting/";const links=[
["index.html","Home",["index.html","home.html"]],["discover.html","Discover",["discover.html"]],["search.html","Search",["search.html"]],["podcasts.html","Podcasts",["podcasts.html","podcast.html","episode.html"]],["creators.html","Creators",["creators.html"]],["member-hub.html","Member Hub",["member-hub.html"]],["my-library.html","Library",["my-library.html","library.html"]],["create-podcast.html","Create",["create-podcast.html"]],["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html"]],["membership.html","Membership",["membership.html"]]
];
function current(){let p=location.pathname.split("/").filter(Boolean).pop()||"index.html";return p.toLowerCase()}
function mount(){document.body.classList.add("cr-has-global-nav");document.querySelectorAll(".cr-global-header").forEach((x,i)=>{if(i)x.remove()});if(document.querySelector(".cr-global-header"))return;
const c=current(),nav=links.map(([href,label,aliases])=>'<a href="'+BASE+href+'" '+(aliases.includes(c)?'aria-current="page"':'')+'>'+label+"</a>").join("");
const h=document.createElement("header");h.className="cr-global-header";h.innerHTML='<div class="cr-global-inner"><a class="cr-global-brand" href="'+BASE+'"><span class="cr-global-brand-mark">CR</span><span class="cr-global-brand-text">CROWRULES <small>PODCASTING</small></span></a><button class="cr-mobile-toggle cr-global-actions" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="cr-global-nav" aria-label="Primary">'+nav+'</nav><div class="cr-global-actions"><a class="cr-extra" href="'+BASE+'login.html">Login</a><a class="cr-account" href="'+BASE+'account-center.html">Account</a></div></div>';
document.body.prepend(h);
const b=h.querySelector(".cr-mobile-toggle"),n=h.querySelector(".cr-global-nav");b.addEventListener("click",()=>{const open=n.classList.toggle("is-open");b.setAttribute("aria-expanded",String(open));b.textContent=open?"×":"☰"});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();