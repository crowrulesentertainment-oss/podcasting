/* CrowRules Universe Experience Engine 11.1 */
(function(){ "use strict";
const U="https://cevylpnoexugwgygvtgu.supabase.co",K="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>{try{const x=new URL(u,location.href);return ["http:","https:"].includes(x.protocol)?x.href:null}catch{return null}};
async function get(db,t,c){try{const r=await db.from(t).select(c).eq("is_active",true);return r.error?[]:(r.data||[])}catch{return[]}}
async function init(){
 const db=window.supabase?.createClient(U,K); if(!db)return;
 const div=(document.body.dataset.crowrulesDivision||"all").toLowerCase(),now=Date.now();
 const [events,announcements]=await Promise.all([get(db,"crowrules_universe_events","id,event_type,title,description,division,starts_at,ends_at,image_url,target_url,theme_slug,is_featured"),get(db,"crowrules_universe_announcements","id,title,body,division,starts_at,ends_at,target_url,priority,is_featured")]);
 const match=x=>(x.division==="all"||x.division===div)&&new Date(x.starts_at).getTime()<=now+30*86400000&&(!x.ends_at||new Date(x.ends_at).getTime()>=now-86400000);
 const es=events.filter(match).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),as=announcements.filter(match).sort((a,b)=>(a.priority??100)-(b.priority??100)||new Date(a.starts_at)-new Date(b.starts_at));
 const live=es.find(x=>new Date(x.starts_at)<=now&&(!x.ends_at||new Date(x.ends_at)>now)),next=live||es.find(x=>new Date(x.starts_at)>now),announcement=as.find(x=>x.is_featured)||as[0]||null;
 window.CrowRulesUniverseExperience={division:div,events:es,announcements:as,live,next,announcement,refresh:init};
 document.dispatchEvent(new CustomEvent("crowrules:experience-ready",{detail:window.CrowRulesUniverseExperience}));
 let box=document.getElementById("cr-universe-experience");
 if(!box&&(live||next||announcement)){box=document.createElement("aside");box.id="cr-universe-experience";box.style="position:fixed;left:16px;bottom:16px;z-index:2147483002;width:min(380px,calc(100vw - 32px));padding:16px;border:1px solid #ffffff25;border-radius:16px;background:#080b14ee;color:#fff;font:600 13px Arial;box-shadow:0 15px 45px #0009;backdrop-filter:blur(12px)";document.body.appendChild(box)}
 if(!box)return;
 const item=live||next; let html=announcement?'<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.65">UNIVERSE ANNOUNCEMENT</div><div style="font-size:16px;margin:5px 0">'+esc(announcement.title)+'</div><div style="opacity:.75">'+esc(announcement.body||"")+'</div>':"";
 if(item)html+='<div style="margin-top:12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#20e6ff">'+(live?"● LIVE NOW":"NEXT UP")+'</div><div style="font-size:17px;margin:5px 0">'+esc(item.title)+'</div><div style="opacity:.7">'+new Date(item.starts_at).toLocaleString()+'</div>'+(item.description?'<div style="opacity:.75;margin-top:5px">'+esc(item.description)+'</div>':"")+(safeUrl(item.target_url)?'<div style="margin-top:9px"><a href="'+esc(safeUrl(item.target_url))+'" style="color:#20e6ff">Open →</a></div>':"");
 box.innerHTML=html;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
setInterval(init,60000);
})();