/* CrowRules Podcasting — Global Header Navigation */
(()=>{"use strict";
const pages={home:"Home","member-hub":"Member Hub","account-center":"Account",discover:"Discover",podcasts:"Podcasts",creators:"Creators","create-podcast":"Create","creator-studio":"Studio",membership:"Membership",profile:"Profile","help-center":"Help"};
const path=(location.pathname.split("/").pop()||"home.html").replace(".html","").toLowerCase();
const nav=[["home.html","Home","home"],["member-hub.html","Member Hub","member-hub"],["account-center.html","Account","account-center"],["discover.html","Discover","discover"],["podcasts.html","Podcasts","podcasts"],["creators.html","Creators","creators"],["create-podcast.html","Create","create-podcast"],["creator-studio.html","Studio","creator-studio"],["membership.html","Membership","membership"],["profile.html","Profile","profile"],["help-center.html","Help","help-center"]];
function init(){
 if(document.querySelector(".cr-pro-bar"))return;
 const bar=document.createElement("header");
 bar.className="cr-pro-bar";
 bar.innerHTML='<a class="cr-pro-brand" href="home.html" aria-label="CrowRules Podcasting home">CROW<span>RULES</span> PODCASTING</a><button class="cr-pro-menu" type="button" aria-expanded="false" aria-controls="cr-pro-links">MENU</button><nav id="cr-pro-links" class="cr-pro-links" aria-label="Podcasting navigation">'+nav.map(n=>'<a href="'+n[0]+'"'+(n[2]===path?' aria-current="page"':'')+'>'+n[1]+'</a>').join("")+'</nav>';
 document.body.prepend(bar);
 const menu=bar.querySelector(".cr-pro-menu"),links=bar.querySelector("#cr-pro-links");
 menu.addEventListener("click",()=>{const open=links.classList.toggle("open");menu.setAttribute("aria-expanded",String(open))});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();