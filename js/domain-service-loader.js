(()=>{"use strict";if(window.__CR_DOMAIN_SERVICE_LOADER_200__)return;window.__CR_DOMAIN_SERVICE_LOADER_200__=true;
const parts=location.pathname.split("/").filter(Boolean),root=parts.length>1?"../":"",file=parts[parts.length-1]?.toLowerCase()||"home.html",base=root+"js/services/";
const load=(src,attr)=>new Promise((resolve,reject)=>{if(document.querySelector('script[src="'+src+'"]'))return resolve();const s=document.createElement("script");s.src=src;s.defer=true;if(attr)s.dataset.crService=attr;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
const style=href=>{if(document.querySelector('link[data-cr-cinematic="1"]'))return;const l=document.createElement("link");l.rel="stylesheet";l.href=href;l.dataset.crCinematic="1";document.head.appendChild(l)};
(async()=>{try{
 if(file!=="index.html"&&file!=="launch.html"&&file!=="global-navigation.html"){style(root+"css/cinematic-system.css");await load(root+"js/global-navigation.js")}
 if(!window.CrowRulesData)await load(root+"js/platform-data.js");
 await(window.CrowRulesData?.ready||Promise.resolve());
 for(const name of ["membership-service.js","notification-service.js","playback-service.js","creator-service.js","stripe-service.js","finance-service.js","member-service.js","discovery-service.js"])if(!document.querySelector('script[data-cr-service="'+name+'"]'))await load(base+name,name);
 window.dispatchEvent(new CustomEvent("crowrules:services-ready"));
}catch(e){console.warn("CrowRules domain services unavailable",e)}})();
})();