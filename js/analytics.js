import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#analytics");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString(), pct=n=>(Number(n||0)*100).toFixed(1)+"%", hrs=n=>(Number(n||0)/3600).toFixed(1);
let cache={};
async function load(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const {data:{user}}=await db.auth.getUser();
 if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to view Audience Intelligence.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const {data:owned,error}=await db.from("podcast_creators").select("podcast_id").eq("user_id",user.id).eq("can_manage",true);
 if(error)throw error; const ids=(owned||[]).map(x=>x.podcast_id);
 if(!ids.length){root.innerHTML='<div class="panel empty"><h2>No managed podcasts yet.</h2><a class="btn primary" href="create-podcast.html">Create podcast</a></div>';return}
 const [p,e,s,r,f,sub]=await Promise.all([
  db.from("podcasts").select("id,title").in("id",ids).order("title"),
  db.from("podcast_episodes").select("id,podcast_id,title,status,published_at,duration_seconds,play_count").in("podcast_id",ids).order("published_at",{ascending:false}),
  db.from("podcast_creator_stats").select("*").eq("user_id",user.id).maybeSingle(),
  db.from("cr_creator_revenue_transactions").select("gross_amount,creator_amount,platform_fee,occurred_at,podcast_id,status").eq("user_id",user.id).in("podcast_id",ids),
  db.from("podcast_follows").select("id,podcast_id,created_at").in("podcast_id",ids).order("created_at"),
  db.from("podcast_subscriptions").select("id,podcast_id,status,started_at,created_at,canceled_at").in("podcast_id",ids).order("created_at")
 ]);
 if(e.error)throw e.error;
 const episodeIds=(e.data||[]).map(x=>x.id); let listens=[];
 if(episodeIds.length){const q=await db.from("podcast_listens").select("id,user_id,episode_id,started_at,seconds_listened,completed,session_key").in("episode_id",episodeIds).order("started_at");if(q.error)throw q.error;listens=q.data||[]}
 cache={pods:p.data||[],eps:e.data||[],stats:s.data||{},rev:r.data||[],follows:f.data||[],subs:sub.data||[],listens};render(30,"all")
}
function render(days,podcastId){
 const {pods,eps,rev,follows,subs,listens}=cache,cut=days?Date.now()-days*86400000:0;
 const E=eps.filter(e=>podcastId==="all"||e.podcast_id===podcastId), eid=new Set(E.map(e=>e.id));
 const L=listens.filter(x=>eid.has(x.episode_id)&&(!cut||new Date(x.started_at).getTime()>=cut));
 const F=follows.filter(x=>(podcastId==="all"||x.podcast_id===podcastId)&&(!cut||new Date(x.created_at).getTime()>=cut));
 const S=subs.filter(x=>(podcastId==="all"||x.podcast_id===podcastId)&&(!cut||new Date(x.started_at||x.created_at).getTime()>=cut));
 const R=rev.filter(x=>(podcastId==="all"||x.podcast_id===podcastId)&&(!cut||new Date(x.occurred_at).getTime()>=cut));
 const seconds=L.reduce((a,x)=>a+Number(x.seconds_listened||0),0),completed=L.filter(x=>x.completed).length;
 const completion=L.length?completed/L.length:0,unique=new Set(L.filter(x=>x.user_id).map(x=>x.user_id)).size;
 const active=S.filter(x=>x.status==="active").length,canceled=S.filter(x=>["canceled","cancelled"].includes(x.status)).length;
 const creator=R.reduce((a,x)=>a+Number(x.creator_amount||0),0);
 const series=buildDaily(L,F,S,days),max=Math.max(1,...series.map(x=>x.listeners));
 const trend=series.map(x=>'<div class="trend-row"><span>'+x.label+'</span><i style="width:'+((x.listeners/max)*100).toFixed(1)+'%"></i><b>'+fmt(x.listeners)+'</b></div>').join("");
 const rows=E.map(e=>{const l=L.filter(x=>x.episode_id===e.id),u=new Set(l.filter(x=>x.user_id).map(x=>x.user_id)).size,sec=l.reduce((a,x)=>a+Number(x.seconds_listened||0),0),c=l.length?l.filter(x=>x.completed).length/l.length:0;return '<tr><td>'+esc(e.title)+'</td><td>'+fmt(e.play_count)+'</td><td>'+fmt(u)+'</td><td>'+hrs(sec)+'</td><td>'+pct(c)+'</td></tr>'}).join("");
 root.innerHTML='<div class="analytics-toolbar"><select id="podcastSelect"><option value="all">All Podcasts</option>'+pods.map(p=>'<option value="'+p.id+'" '+(podcastId===p.id?"selected":"")+'>'+esc(p.title)+'</option>').join("")+'</select><select id="rangeSelect">'+[[7,"7 days"],[30,"30 days"],[90,"90 days"],[365,"Year"],[0,"All time"]].map(x=>'<option value="'+x[0]+'" '+(days===x[0]?"selected":"")+'>'+x[1]+'</option>').join("")+'</select><button class="btn" id="export">Export Growth Report</button></div>'+
 '<section class="kpis"><div class="panel kpi"><span class="muted">Sessions</span><strong>'+fmt(L.length)+'</strong></div><div class="panel kpi"><span class="muted">Unique listeners</span><strong>'+fmt(unique)+'</strong></div><div class="panel kpi"><span class="muted">Listening hours</span><strong>'+hrs(seconds)+'</strong></div><div class="panel kpi"><span class="muted">Completion</span><strong>'+pct(completion)+'</strong></div><div class="panel kpi"><span class="muted">Followers gained</span><strong>'+fmt(F.length)+'</strong></div><div class="panel kpi"><span class="muted">Active subscribers</span><strong>'+fmt(active)+'</strong></div></section>'+
 '<section class="charts"><article class="panel chart-card"><p class="eyebrow">DAILY / WEEKLY TREND</p><h2>Identified listeners</h2><div class="trend-list">'+(trend||'<span class="muted">No listening data yet.</span>')+'</div></article><article class="panel chart-card"><p class="eyebrow">RETENTION</p><h2>Listener quality</h2><div class="insight">Completion rate: <b>'+pct(completion)+'</b> from '+fmt(L.length)+' sessions.</div><div class="insight">Average session: <b>'+(L.length?(seconds/L.length/60).toFixed(1):"0")+' minutes</b>.</div><div class="insight"><b>'+fmt(unique)+'</b> identified users. Anonymous sessions remain counted in sessions.</div></article></section>'+
 '<section class="charts"><article class="panel chart-card"><p class="eyebrow">AUDIENCE GROWTH</p><h2>Followers & subscriptions</h2><div class="insight"><b>'+fmt(F.length)+'</b> followers gained.</div><div class="insight"><b>'+fmt(S.length)+'</b> subscription records started.</div><div class="insight"><b>'+fmt(active)+'</b> currently active; <b>'+fmt(canceled)+'</b> canceled/cancelled.</div><div class="insight">Directional follower/session ratio: <b>'+(unique?pct(F.length/unique):"0.0%")+'</b>. This is not a cohort conversion rate.</div></article><article class="panel chart-card"><p class="eyebrow">CREATOR GROWTH REPORT</p><h2>Production snapshot</h2><div class="insight">'+fmt(E.filter(e=>e.status==="published").length)+' published episodes in this view.</div><div class="insight">'+fmt(L.length)+' listening sessions produced '+hrs(seconds)+' listening hours.</div><div class="insight">Creator revenue recorded: <b>$'+(creator/100).toFixed(2)+'</b>.</div><div class="insight">Geography/device data is not shown because the verified listening table does not store those fields.</div></article></section>'+
 '<section class="panel" style="margin-top:18px"><div class="section-head"><div><p class="eyebrow">EPISODE INTELLIGENCE</p><h2>Retention by episode</h2></div></div><div class="scroll"><table class="episode-table"><thead><tr><th>Episode</th><th>Plays</th><th>Listeners</th><th>Listening hours</th><th>Completion</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No episode data.</td></tr>')+'</tbody></table></div></section>';
 document.getElementById("podcastSelect").onchange=e=>render(Number(document.getElementById("rangeSelect").value),e.target.value);
 document.getElementById("rangeSelect").onchange=e=>render(Number(e.target.value),document.getElementById("podcastSelect").value);
 document.getElementById("export").onclick=()=>exportCSV(E,L,F,S,R);
}
function buildDaily(L,F,S,days){const n=days===0?30:days<=30?days:days<=90?13:12,span=days===0?30:days,step=(span*86400000)/n,end=Date.now(),out=[];for(let i=n-1;i>=0;i--){const b=end-(i+1)*step,t=end-i*step;const users=new Set(L.filter(x=>{const d=new Date(x.started_at).getTime();return d>=b&&d<t&&x.user_id}).map(x=>x.user_id));out.push({label:new Date(b).toLocaleDateString(undefined,{month:"short",day:"numeric"}),listeners:users.size,follows:F.filter(x=>{const d=new Date(x.created_at).getTime();return d>=b&&d<t}).length,subs:S.filter(x=>{const d=new Date(x.started_at||x.created_at).getTime();return d>=b&&d<t}).length})}return out}
function exportCSV(E,L,F,S,R){const rows=[["section","item","metric","value"],...E.map(x=>["episode",x.title,"plays",x.play_count||0]),...L.map(x=>["listen",x.episode_id,"seconds_listened",x.seconds_listened||0]),...F.map(x=>["follow",x.podcast_id,"created_at",x.created_at]),...S.map(x=>["subscription",x.podcast_id,"status",x.status]),...R.map(x=>["revenue",x.podcast_id,"creator_amount_cents",x.creator_amount||0])];const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="crowrules-audience-growth-report.csv";a.click();URL.revokeObjectURL(a.href)}
load().catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Audience Intelligence could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});