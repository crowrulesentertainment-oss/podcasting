/* CrowRules Podcasting — Universal Monetization Integration 1.0 */
(()=>{"use strict";
if(window.__CR_MONETIZATION_INTEGRATION__)return;window.__CR_MONETIZATION_INTEGRATION__=true;
const cfg=window.CROWRULES_CONFIG||{},url=cfg.supabaseUrl,key=cfg.supabasePublishableKey;
function boot(){if(!window.supabase||!url||!key)return;const sb=window.crSupabase||window.CROWRULES_SUPABASE||window.window.CrowRulesData.getClient();window.crSupabase=sb;
const path=location.pathname.split("/").pop().toLowerCase(),root=location.pathname.split("/").filter(Boolean).length>1?"../":"";
const strip=document.createElement("div");strip.className="cr-monetization-strip";strip.setAttribute("aria-live","polite");strip.innerHTML='<span><strong>CROWRULES MONETIZATION</strong> · <span class="cr-monetization-dot off"></span>Checking account…</span><span><a href="'+root+'premium-library.html">Premium Library</a> <a href="'+root+'creator-monetization-hub.html">Creator Monetization</a> <a href="'+root+'playback-security.html">Security</a></span>';
document.body.insertBefore(strip,document.body.firstChild?.nextSibling||document.body.firstChild);
async function sync(){const {data:{user}}=await window.CrowRulesData.getUser().then(user=>({data:{user}}));const dot=strip.querySelector(".cr-monetization-dot"),text=strip.querySelector("span");if(!user){dot.className="cr-monetization-dot off";text.innerHTML='<strong>CROWRULES MONETIZATION</strong> · Sign in to access premium playback, library, and creator tools.';return}const r=await window.CrowRulesPlayback.securitySummary().then(data=>({data}));if(r.error){dot.className="cr-monetization-dot warn";text.innerHTML='<strong>CROWRULES MONETIZATION</strong> · Account connected · Security status unavailable.';return}dot.className="cr-monetization-dot";text.innerHTML='<strong>CROWRULES MONETIZATION</strong> · Account connected · '+(r.data?.active_sessions??0)+' active playback session'+((r.data?.active_sessions??0)===1?"":"s")+' · '+(r.data?.events_24h??0)+' security events / 24h.'}
sync();window.CrowRulesData.on(()=>sync());
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();