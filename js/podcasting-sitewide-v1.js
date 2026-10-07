(()=>{"use strict";
const path=(location.pathname.split("/").pop()||"home.html").toLowerCase();
const page=path==="account.html"?"account":path==="launch.html"?"launch":"home";
const links=[["home.html","HOME","home"],["home.html#shows","SHOWS","shows"],["home.html#episodes","EPISODES","episodes"],["home.html#community","COMMUNITY","community"],["home.html#creators","CREATORS","creators"],["launch.html","LAUNCH","launch"]];
const mark=(href,label,key)=>'<a href="'+href+'" '+(page===key?'aria-current="page"':"")+'>'+label+"</a>";
const bar=document.createElement("header");
bar.className="cr-sitebar";
bar.innerHTML='<a class="cr-sitebar__brand" href="home.html" aria-label="CrowRules Podcasting home"><span class="cr-sitebar__mark">CR</span><span>CROWRULES / PODCASTING</span></a><nav class="cr-sitebar__nav" aria-label="Podcasting navigation">'+links.slice(0,5).map(x=>mark(x[0],x[1],x[2])).join("")+'</nav><div class="cr-sitebar__actions"><a class="cr-sitebar__launch" href="launch.html">LAUNCH</a><a class="cr-sitebar__account" href="account.html">ACCOUNT</a><button class="cr-sitebar__toggle" type="button" aria-expanded="false" aria-controls="crSiteMenu" aria-label="Open navigation">☰</button></div><nav class="cr-sitebar__panel" id="crSiteMenu" aria-label="Mobile Podcasting navigation">'+links.map(x=>mark(x[0],x[1],x[2])).join("")+'<a href="https://crowrulesentertainment-oss.github.io/crowrulesentertainment/crowspace/">CROWSPACE ↗</a></nav>';
document.body.prepend(bar);
if(page!=="launch")document.body.classList.add("cr-sitebar-page");
if(page==="home"){bar.querySelectorAll('a[href^="home.html#"]').forEach(a=>a.addEventListener("click",()=>{document.getElementById("crSiteMenu")?.classList.remove("open")}));}
const toggle=bar.querySelector(".cr-sitebar__toggle"),menu=bar.querySelector("#crSiteMenu");
toggle?.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Close navigation":"Open navigation")});
menu?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){menu?.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}});
})();
