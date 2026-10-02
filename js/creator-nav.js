(function(){
"use strict";
const LINKS=[
  ["Studio","creator-dashboard.html"],
  ["My Podcasts","podcasts.html"],
  ["Create Podcast","create-podcast.html"],
  ["Create Episode","create-episode.html"],
  ["Pipeline","publishing-pipeline.html"],
  ["Intelligence","creator-intelligence.html"],
  ["Analytics","analytics.html"],
  ["Calendar","release-calendar.html"],
  ["Distribution","distribution.html"],
  ["Profile","creator-profile.html"],
  ["Payouts","creator-payouts.html"],
  ["Account","account.html"]
];
function init(){
  const host=document.querySelector("[data-nav]");
  if(!host||host.dataset.creatorNavReady==="true")return;
  host.dataset.creatorNavReady="true";
  const current=location.pathname.split("/").pop()||"index.html";
  host.innerHTML='<style id="creator-global-nav-css">.crgn{position:sticky;top:0;z-index:1000;background:rgba(8,10,18,.96);backdrop-filter:blur(18px);border-bottom:1px solid #ffffff12}.crgn-inner{max-width:1180px;margin:auto;min-height:62px;padding:8px 18px;display:flex;align-items:center;gap:18px}.crgn-brand{font-weight:900;white-space:nowrap;color:#fff;text-decoration:none}.crgn-brand span{opacity:.55;font-weight:600}.crgn-links{display:flex;align-items:center;gap:4px;overflow:auto;scrollbar-width:none}.crgn-links::-webkit-scrollbar{display:none}.crgn-links a{padding:9px 10px;border-radius:9px;color:#bfc5d5;text-decoration:none;white-space:nowrap;font-size:.84rem}.crgn-links a:hover,.crgn-links a.active{background:#ffffff0b;color:#fff}.crgn-toggle{display:none;margin-left:auto;border:1px solid #ffffff18;background:#ffffff08;color:#fff;border-radius:9px;padding:9px 12px;font-size:1rem}@media(max-width:900px){.crgn-inner{position:relative}.crgn-toggle{display:block}.crgn-links{display:none;position:absolute;left:12px;right:12px;top:58px;padding:10px;background:#0b0f1bf8;border:1px solid #ffffff15;border-radius:14px;box-shadow:0 20px 50px #0008;flex-direction:column;align-items:stretch}.crgn-links.open{display:flex}.crgn-links a{padding:12px}}</style><div class="crgn"><nav class="crgn-inner" aria-label="CrowRules Podcasting global navigation"><a class="crgn-brand" href="index.html">CrowRules <span>Podcasting</span></a><div class="crgn-links">'+LINKS.map(([label,href])=>'<a href="'+href+'"'+(current===href?' class="active" aria-current="page"':'')+'>'+label+'</a>').join("")+'</div><button class="crgn-toggle" type="button" aria-expanded="false" aria-label="Open navigation">☰</button></nav></div>';
  const btn=host.querySelector(".crgn-toggle"),links=host.querySelector(".crgn-links");
  btn?.addEventListener("click",()=>{const open=links.classList.toggle("open");btn.setAttribute("aria-expanded",String(open));btn.setAttribute("aria-label",open?"Close navigation":"Open navigation")});
  links?.addEventListener("click",e=>{if(e.target.closest("a"))links.classList.remove("open")});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();