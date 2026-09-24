/* CrowRules Podcasting — Domain Service Loader 1.0 */
(()=>{"use strict";if(window.__CR_DOMAIN_SERVICE_LOADER__)return;window.__CR_DOMAIN_SERVICE_LOADER__=true;
const base=(window.CROWRULES_CONFIG?.assetBase||"js/services/").replace(/\/?$/,"/");
["membership-service.js","notification-service.js","playback-service.js","creator-service.js","stripe-service.js","finance-service.js"].forEach(name=>{if(document.querySelector('script[data-cr-service="'+name+'"]'))return;const s=document.createElement("script");s.src=base+name;s.defer=true;s.dataset.crService=name;document.head.appendChild(s)});
})();