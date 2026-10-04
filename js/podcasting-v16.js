(()=>{"use strict";
const C=()=>window.CROW_SUPABASE;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>Number(v||0).toLocaleString();
const money=v=>"$"+(Number(v||0)/100).toFixed(2);
async function user(){try{return (await C().auth.getUser()).data?.user||null}catch{return null}}
async function creatorFor(u,id){const s=C();if(id){let q=await s.from("creators").select("id,name,display_name,avatar_url").eq("id",id).maybeSingle();if(!q.error&&q.data)return q.data; q=await s.from("creator_profiles").select("creator_id,display_name,name,avatar_url").eq("id",id).maybeSingle();if(!q.error&&q.data?.creator_id)return {id:q.data.creator_id,name:q.data.display_name||q.data.name,avatar_url:q.data.avatar_url}}if(!u)return null;let q=await s.from("creators").select("id,name,display_name,avatar_url").eq("member_id",u.id).maybeSingle();if(!q.error&&q.data)return q.data;q=await s.from("creators").select("id,name,display_name,avatar_url").eq("id",u.id).maybeSingle();return !q.error?q.data:null}
async function count(t,col,id){try{const q=await C().from(t).select("id",{count:"exact",head:true}).eq(col,id);return q.error?null:q.count||0}catch{return null}}
async function stats(creatorId){
 const s=C();const out={followers:null,subscribers:null,plays:0,listeningMinutes:0,episodes:0,shows:0};
 const p=await s.from("podcasts").select("id,title,listener_count,total_plays").eq("creator_id",creatorId);out.shows=p.error?0:(p.data||[]).length;
 const ids=(p.data||[]).map(x=>x.id);out.plays=(p.data||[]).reduce((n,x)=>n+Number(x.total_plays||0),0);
 const e=ids.length?await s.from("podcast_episodes").select("id,title,podcast_id,published_at,play_count,duration_seconds,status").in("podcast_id",ids):{data:[],error:null};
 out.episodes=e.error?0:(e.data||[]).length;out.episodesData=e.data||[];
 out.follows=ids.length?await count("podcast_follows","podcast_id",ids[0]):null;
 if(ids.length){try{const q=await s.from("podcast_follows").select("id",{count:"exact",head:true}).in("podcast_id",ids);out.followers=q.error?null:q.count||0}catch{}}
 try{const q=await s.from("podcast_subscriptions").select("id",{count:"exact",head:true}).in("podcast_id",ids).in("status",["active","trialing","past_due","paused"]);out.subscribers=q.error?null:q.count||0}catch{}
 const epids=out.episodesData.map(x=>x.id);
 if(epids.length){try{const q=await s.from("podcast_listens").select("seconds_listened,completed").in("episode_id",epids);if(!q.error){out.listeningMinutes=(q.data||[]).reduce((n,x)=>n+Number(x.seconds_listened||0),0)/60;out.listenCount=(q.data||[]).length;out.completed=(q.data||[]).filter(x=>x.completed).length}}catch{}}
 return out
}
function mount(host,title,body){let el=document.getElementById(host);if(!el){el=document.createElement("section");el.id=host;el.className="v16-section";document.querySelector("main")?.appendChild(el)}el.innerHTML='<div class="v16-head"><div><span>V16 ANALYTICS</span><h2>'+title+'</h2></div><small>Live Supabase intelligence</small></div>'+body;return el}
function renderStats(st){
 const conv=st.listenCount?((st.completed||0)/st.listenCount*100).toFixed(1):"0.0";
 return '<div class="v16-kpis"><div><b>'+fmt(st.followers)+'</b><span>Followers</span></div><div><b>'+fmt(st.subscribers)+'</b><span>Subscribers</span></div><div><b>'+fmt(st.plays)+'</b><span>Catalog Plays</span></div><div><b>'+fmt(st.listeningMinutes)+'</b><span>Minutes Listened</span></div><div><b>'+fmt(st.episodes)+'</b><span>Episodes</span></div><div><b>'+conv+'%</b><span>Completion</span></div></div>'
}
function renderEpisodes(st){
 const eps=[...st.episodesData].sort((a,b)=>Number(b.play_count||0)-Number(a.play_count||0)).slice(0,8),max=Math.max(1,...eps.map(x=>Number(x.play_count||0)));
 return '<div class="v16-episodes">'+(eps.length?eps.map((e,i)=>'<div class="v16-ep"><div><strong>#'+(i+1)+' '+esc(e.title)+'</strong><small>'+esc(e.status||"published")+' · '+(e.published_at?new Date(e.published_at).toLocaleDateString():"Unscheduled")+'</small></div><b>'+fmt(e.play_count)+'</b><i style="--w:'+Math.max(3,Math.round(Number(e.play_count||0)/max*100))+'%"></i></div>').join(""):'<div class="v16-empty">No episode performance data yet. Publish and receive listening activity to populate this panel.</div>')+'</div>'
}
async function alerts(creatorId,u){
 if(!u)return'<div class="v16-empty">Sign in to receive creator alerts.</div>';
 try{const q=await C().from("creator_realtime_alerts").select("id,alert_type,severity,title,message,action_url,is_read,created_at").eq("user_id",u.id).eq("creator_id",creatorId).order("created_at",{ascending:false}).limit(8);if(q.error)throw q.error;return (q.data||[]).length?(q.data||[]).map(a=>'<div class="v16-alert '+esc(a.severity)+'"><span></span><div><strong>'+esc(a.title)+'</strong><p>'+esc(a.message)+'</p><small>'+new Date(a.created_at).toLocaleString()+'</small></div></div>').join(""):'<div class="v16-empty">No realtime creator alerts yet.</div>'}catch(e){return'<div class="v16-empty">Creator alerts are unavailable to this session.</div>'}
}
async function realtime(creatorId,u){
 const s=C();if(!s||!creatorId)return;
 try{s.channel("cr-v16-"+creatorId).on("postgres_changes",{event:"*",schema:"public",table:"podcast_listens"},()=>window.CROW_V16_REFRESH?.()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_follows"},()=>window.CROW_V16_REFRESH?.()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_subscriptions"},()=>window.CROW_V16_REFRESH?.()).on("postgres_changes",{event:"*",schema:"public",table:"creator_realtime_alerts",filter:"creator_id=eq."+creatorId},()=>window.CROW_V16_REFRESH?.()).subscribe()}catch{}
}
async function run(){
 if(!C())return;const u=await user(),params=new URLSearchParams(location.search),id=params.get("creator_id")||params.get("creator");
 const cr=await creatorFor(u,id);if(!cr?.id)return;
 const st=await stats(cr.id);window.CROW_V16={creator:cr,stats:st};
 const profile=document.getElementById("content")||document.querySelector("main");
 const isPublic=location.pathname.includes("creator-profile");
 if(isPublic){
  mount("v16Audience","Audience & Performance",renderStats(st)+'<div class="v16-cols"><div><h3>Episode Performance</h3>'+renderEpisodes(st)+'</div><div><h3>Realtime Creator Alerts</h3><div id="v16Alerts">'+await alerts(cr.id,u)+'</div></div></div>');
 }else{
  mount("v16Studio","Creator Operations Analytics",renderStats(st)+'<div class="v16-cols"><div><h3>Episode Performance</h3>'+renderEpisodes(st)+'</div><div><h3>Realtime Creator Alerts</h3><div id="v16Alerts">'+await alerts(cr.id,u)+'</div></div></div>');
 }
 window.CROW_V16_REFRESH=async()=>{const fresh=await stats(cr.id);window.CROW_V16.stats=fresh;const host=document.getElementById(isPublic?"v16Audience":"v16Studio");if(host){host.querySelector(".v16-kpis")?.replaceWith(document.createRange().createContextualFragment(renderStats(fresh)).firstElementChild);const ep=host.querySelector(".v16-episodes");if(ep)ep.outerHTML=renderEpisodes(fresh)}};
 realtime(cr.id,u);
}
window.addEventListener("crow:ready",run);if(document.readyState!=="loading")setTimeout(run,900);else document.addEventListener("DOMContentLoaded",()=>setTimeout(run,900));
})();