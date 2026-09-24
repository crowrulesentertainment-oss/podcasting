import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#analytics");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const money=n=>"$"+(Number(n||0)/100).toFixed(2),fmt=n=>Number(n||0).toLocaleString();
let cache={};
async function load(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const {data:{user}}=await db.auth.getUser();
 if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to view creator analytics.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const {data:owned}=await db.from("podcast_creators").select("podcast_id").eq("user_id",user.id).eq("can_manage",true);
 const ids=(owned||[]).map(x=>x.podcast_id);
 if(!ids.length){root.innerHTML='<div class="panel empty"><h2>No managed podcasts yet.</h2><a class="btn primary" href="create-podcast.html">Create podcast</a></div>';return}
 const [{data:pods},{data:eps},{data:stats},{data:rev},{data:follows}]=await Promise.all([
  db.from("podcasts").select("id,title").in("id",ids).order("title"),
  db.from("podcast_episodes").select("id,podcast_id,title,status,published_at,duration_seconds,play_count").in("podcast_id",ids).order("published_at",{ascending:false}),
  db.from("podcast_creator_stats").select("*").eq("user_id",user.id).maybeSingle(),
  db.from("cr_creator_revenue_transactions").select("gross_amount,creator_amount,occurred_at,podcast_id,status").eq("user_id",user.id).order("occurred_at",{ascending:false}),
  db.from("podcast_follows").select("id,podcast_id,created_at").in("podcast_id",ids)
 ]);
 cache={pods:pods||[],eps:eps||[],stats:stats||{},rev:rev||[],follows:follows||[]};render(30,"all")
}
function render(days,podcastId){
 const {pods,eps,stats,rev,follows}=cache,cutoff=days?Date.now()-days*86400000:0;
 const E=eps.filter(e=>podcastId==="all"||e.podcast_id===podcastId);
 const R=rev.filter(x=>(podcastId==="all"||x.podcast_id===podcastId)&&(!cutoff||new Date(x.occurred_at).getTime()>=cutoff));
 const F=follows.filter(x=>(podcastId==="all"||x.podcast_id===podcastId)&&(!cutoff||new Date(x.created_at).getTime()>=cutoff));
 const plays=E.reduce((a,e)=>a+Number(e.play_count||0),0),gross=R.reduce((a,x)=>a+Number(x.gross_amount||0),0),creator=R.reduce((a,x)=>a+Number(x.creator_amount||0),0),published=E.filter(e=>e.status==="published").length,listening=Number(stats.listening_seconds||0);
 const max=Math.max(1,...E.slice(0,14).map(e=>Number(e.play_count||0)));
 const bars=E.slice(0,14).reverse().map(e=>'<div class="bar" style="height:'+Math.max(4,Number(e.play_count||0)/max*100)+'%"><span>'+fmt(e.play_count)+'</span></div>').join("");
 const rows=E.slice(0,20).map(e=>'<tr><td>'+esc(e.title)+'</td><td>'+esc(e.status)+'</td><td>'+fmt(e.play_count)+'</td><td>'+fmt(e.duration_seconds)+' sec</td><td>'+(e.published_at?new Date(e.published_at).toLocaleDateString():"—")+'</td></tr>').join("");
 root.innerHTML='<div class="analytics-toolbar"><select id="podcastSelect"><option value="all">All Podcasts</option>'+pods.map(p=>'<option value="'+p.id+'" '+(podcastId===p.id?"selected":"")+'>'+esc(p.title)+'</option>').join("")+'</select><select id="rangeSelect">'+[[7,"7 days"],[30,"30 days"],[90,"90 days"],[365,"Year"],[0,"All time"]].map(x=>'<option value="'+x[0]+'" '+(days===x[0]?"selected":"")+'>'+x[1]+'</option>').join("")+'</select><button class="btn export" id="export">Export CSV</button></div><section class="kpis"><div class="panel kpi"><span class="muted">Episode plays</span><strong>'+fmt(plays)+'</strong></div><div class="panel kpi"><span class="muted">Followers gained</span><strong>'+fmt(F.length)+'</strong></div><div class="panel kpi"><span class="muted">Listening hours</span><strong>'+(listening/3600).toFixed(1)+'</strong></div><div class="panel kpi"><span class="muted">Published</span><strong>'+published+'</strong></div><div class="panel kpi"><span class="muted">Gross revenue</span><strong>'+money(gross)+'</strong></div><div class="panel kpi"><span class="muted">Creator revenue</span><strong>'+money(creator)+'</strong></div></section><section class="charts"><article class="panel chart-card"><p class="eyebrow">EPISODE PERFORMANCE</p><h2>Recent plays</h2><div class="bar-chart">'+(bars||'<span class="muted">No episode play data yet.</span>')+'</div></article><article class="panel chart-card"><p class="eyebrow">INSIGHTS</p><h2>Current picture</h2><div class="insight">'+fmt(published)+' published episodes are in this view.</div><div class="insight">'+fmt(F.length)+' follower records were created in the selected period.</div><div class="insight">'+money(creator)+' creator revenue is recorded in the selected period.</div><div class="insight">'+(listening?'Creator-level listening time is available.':'Listening-time data is not available yet.')+'</div></article></section><section class="panel" style="margin-top:18px"><div class="section-head"><div><p class="eyebrow">EPISODE TABLE</p><h2>Performance</h2></div><a class="btn" href="episodes.html">Manage episodes</a></div><div class="scroll"><table class="episode-table"><thead><tr><th>Episode</th><th>Status</th><th>Plays</th><th>Duration</th><th>Published</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No episodes found.</td></tr>')+'</tbody></table></div></section>';
 document.getElementById("podcastSelect").onchange=e=>render(Number(document.getElementById("rangeSelect").value),e.target.value);
 document.getElementById("rangeSelect").onchange=e=>render(Number(e.target.value),document.getElementById("podcastSelect").value);
 document.getElementById("export").onclick=()=>downloadCSV(E,R)
}
function downloadCSV(E,R){const data=[["type","title","status","plays","duration_seconds","published_at","gross_amount_cents","creator_amount_cents"],...E.map(e=>["episode",e.title,e.status,e.play_count||0,e.duration_seconds||0,e.published_at||"","",""]),...R.map(r=>["revenue",r.podcast_id||"",r.status||"","","",r.occurred_at||"",r.gross_amount||0,r.creator_amount||0])];const csv=data.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="crowrules-podcast-analytics.csv";a.click();URL.revokeObjectURL(a.href)}
load();