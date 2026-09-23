/* CrowRules Podcasting — Professional Experience Layer */
(()=>{"use strict";
const pages={home:"Home",discover:"Discover",podcasts:"Podcasts",creators:"Creators","create-podcast":"Create Podcast","creator-studio":"Creator Studio",membership:"Membership",profile:"Profile","help-center":"Help Center"};
const path=(location.pathname.split("/").pop()||"home.html").replace(".html","").toLowerCase(), current=pages[path]||"Podcasting";
const nav=[["home.html","Home","home"],["discover.html","Discover","discover"],["podcasts.html","Podcasts","podcasts"],["creators.html","Creators","creators"],["create-podcast.html","Create","create-podcast"],["creator-studio.html","Studio","creator-studio"],["membership.html","Membership","membership"],["profile.html","Profile","profile"],["help-center.html","Help","help-center"]];
function init(){
 if(document.querySelector(".cr-pro-bar"))return;
 const skip=document.createElement("a");skip.className="cr-pro-skip";skip.href="#main-content";skip.textContent="Skip to content";document.body.prepend(skip);
 const bar=document.createElement("header");bar.className="cr-pro-bar";bar.innerHTML='<a class="cr-pro-brand" href="home.html">CROW<span>RULES</span> PODCASTING</a><button class="cr-pro-menu" type="button" aria-expanded="false" aria-controls="cr-pro-links">MENU</button><nav id="cr-pro-links" class="cr-pro-links" aria-label="Podcasting navigation">'+nav.map(n=>'<a href="'+n[0]+'"'+(n[2]===path?' aria-current="page"':'')+'>'+n[1]+'</a>').join("")+'</nav>';document.body.prepend(bar);
 const menu=bar.querySelector(".cr-pro-menu"),links=bar.querySelector("#cr-pro-links");menu.onclick=()=>{const open=links.classList.toggle("open");menu.setAttribute("aria-expanded",String(open))};
 const main=document.querySelector("main")||document.body;if(!main.id)main.id="main-content";
 const crumb=document.createElement("div");crumb.className="cr-pro-crumbs";crumb.innerHTML='<a href="home.html">CrowRules Podcasting</a> <span aria-hidden="true">/</span> <span>'+current+'</span>';bar.after(crumb);
 const footer=document.createElement("footer");footer.className="cr-pro-footer";footer.innerHTML='<div><strong>CrowRules Podcasting</strong><br>One Account. One Universe. Your Voice. Your Story.</div><nav aria-label="Footer"><a href="membership.html">Membership</a><a href="profile.html">Profile</a><a href="help-center.html">Help Center</a><a href="support.html">Support</a><a href="site-map.html">Site Map</a></nav><div>© 2026 CrowRules Entertainment</div>';document.body.append(footer);
 document.querySelectorAll(".card,.podcast-card,.di-card,.di-creator,.creator-card,.feature-card,.stat-card").forEach(el=>el.classList.add("cr-pro-card"));
 const toast=document.createElement("div");toast.className="cr-pro-toast";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");document.body.append(toast);window.CrowRulesPro={toast:(msg)=>{toast.textContent=msg;toast.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove("show"),3200)}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();