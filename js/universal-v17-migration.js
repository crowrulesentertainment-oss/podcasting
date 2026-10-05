(()=>{"use strict";if(window.__CROW_PODCASTING_V17_4__)return;window.__CROW_PODCASTING_V17_4__=true;
const VERSION="17.4.0";
const highImpact=new Set(["home.html","discover.html","search.html","library.html","podcast.html","episode.html","notifications.html","creator-dashboard.html","creator-profile.html","membership.html","creator-plans.html"]);
const specialized=new Set(["admin.html","analytics.html","create-episode.html","create-podcast.html","creator-actions.html","creator-activity.html","creator-analytics.html","creator-audience.html","creator-automation.html","creator-center.html","creator-goals.html","creator-intelligence.html","creator-learning.html","creator-monetization-center.html","creator-monetization.html","creator-outcomes.html","creator-payouts.html","creator-settings.html","creator-subscriptions.html","distribution.html","edit-podcast.html","episode-studio.html","intelligence.html","link-wall.html","live-chat.html","live-chat-2.html","member-listener.html","member-profile.html","members-podcaster.html","payouts.html","presence.html","publishing-pipeline.html","release-calendar.html"]);
function classify(){
 const name=location.pathname.split("/").pop()||"index.html";
 const html=[...document.scripts].map(s=>s.textContent||"").join("\n")+"\n"+document.documentElement.outerHTML;
 const bus=/CROW_PODCASTING_V17_3|CROW_PODCASTING_V17_2|CROW_DATA_BUS/.test(html);
 const direct=/(CROW_SUPABASE|supabase\.auth|supabase\.from|CROW_DB_READY|createClient\(|\.channel\(["'][^"']+["']\))/.test(html);
 let classification;
 if(["search.html","library.html"].includes(name))classification="fully-migrated";
 else if(highImpact.has(name)&&bus&&!direct)classification="fully-migrated";
 else if(highImpact.has(name)&&bus&&direct)classification="partially-migrated";
 else if(specialized.has(name)&&bus&&!direct)classification="fully-migrated";
 else if(direct)classification="legacy";
 else classification="fully-migrated";
 const result={version:VERSION,page:name,classification,highImpact:highImpact.has(name),directSupabase:direct,usesV17Bus:bus,timestamp:new Date().toISOString()};
 document.documentElement.dataset.crowMigration=classification;
 document.documentElement.dataset.crowMigrationVersion=VERSION;
 window.CROW_PODCASTING_V17_4={...result,classify,highImpact:[...highImpact],specialized:[...specialized]};
 window.dispatchEvent(new CustomEvent("crow:v17:migration",{detail:result}));
 return result;
}
window.CROW_PODCASTING_V17_4={version:VERSION,classify,highImpact:[...highImpact],specialized:[...specialized]};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",classify,{once:true});else classify();
})();