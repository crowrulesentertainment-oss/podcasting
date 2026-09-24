/* CrowRules Podcasting — Domain Service Loader 1.1 */
(()=>{"use strict";if(window.__CR_DOMAIN_SERVICE_LOADER__)return;window.__CR_DOMAIN_SERVICE_LOADER__=true;
const cfg=window.CROWRULES_CONFIG||{},root=(location.pathname.split("/").filter(Boolean).length>1?"../":"");
const base=root+"js/services/";
const load=(src,attr)=>new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.defer=true;if(attr)s.dataset.crService=attr;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
(async()=>{try{
 if(!window.CrowRulesData){await load(root+"js/platform-data.js");}
 await (window.CrowRulesData?.ready||Promise.resolve());
 for(const name of ["membership-service.js","notification-service.js","playback-service.js","creator-service.js","stripe-service.js","finance-service.js","member-service.js"]){
   if(!document.querySelector('script[data-cr-service="'+name+'"]')) await load(base+name,name);
 }
 window.dispatchEvent(new CustomEvent("crowrules:services-ready"));
}catch(e){console.warn("CrowRules domain services unavailable",e)}})();
})();