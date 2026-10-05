(()=>{"use strict";
const $=id=>document.getElementById(id), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])), fmt=v=>Number(v||0).toLocaleString();
let sb,user,creator,tasks=[],episodes=[],alerts=[],podcasts=[],timer;

async function client(){return window.CROW_SUPABASE||window.CROW_SUPABASE_READY?await(window.CROW_SUPABASE||window.CROW_SUPABASE_READY):null}
async function init(){
  sb=await client(); if(!sb)return;
  user=(await sb.auth.getUser()).data?.user; if(!user)return;
  const q=await sb.rpc("get_my_podcast_creator_id"); if(q.error||!q.data)return;
  creator=q.data; await load(); render(); realtime();
}
async function load(){
  const ids=(await sb.from("podcasts").select("id,title,status,category,total_plays,listener_count").eq("creator_id",creator)).data||[];
  podcasts=ids;
  const pids=ids.map(x=>x.id);
  episodes=pids.length?((await sb.from("podcast_episodes").select("id,title,podcast_id,status,published_at,scheduled_at,play_count,duration_seconds,tags").in("podcast_id",pids).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(200)).data||[]):[];
  const tq=await sb.from("podcast_workflow_tasks").select("*").eq("creator_id",creator).order("due_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}).limit(100);
  tasks=tq.error?[]:(tq.data||[]);
  const aq=await sb.from("creator_realtime_alerts").select("id,alert_type,severity,title,message,action_url,is_read,created_at").eq("creator_id",creator).order("created_at",{ascending:false}).limit(30);
  alerts=aq.error?[]:(aq.data||[]);
}
function statusBadge(x){return '<span class="v20-badge '+esc(x)+'">'+esc(x.replaceAll("_"," "))+"</span>"}
function taskRows(){
  const open=tasks.filter(x=>["open","in_progress","escalated"].includes(x.status));
  if(!open.length)return '<div class="v20-empty">No open workflow tasks. The engine will create recurring work, milestone actions and escalations as real data changes.</div>';
  return open.slice(0,12).map(x=>'<div class="v20-task"><div><b>'+esc(x.title)+'</b><small>'+esc(x.description||"Workflow task")+(x.due_at?" · Due "+new Date(x.due_at).toLocaleString():"")+'</small></div><div class="v20-task-actions">'+statusBadge(x.priority)+'<button data-v20-complete="'+esc(x.id)+'">COMPLETE</button></div></div>').join("");
}
function scheduleRows(){
  const now=Date.now(), future=episodes.filter(x=>x.scheduled_at&&new Date(x.scheduled_at).getTime()>=now).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,10);
  if(!future.length)return '<div class="v20-empty">No episodes are currently scheduled. Scheduled episodes are published automatically by the Supabase workflow every 5 minutes.</div>';
  return future.map(x=>'<div class="v20-calendar-row"><div><b>'+esc(x.title)+'</b><small>'+esc(x.status)+'</small></div><strong>'+new Date(x.scheduled_at).toLocaleString()+'</strong></div>').join("");
}
function calendar(){
  const now=new Date(), days=[];
  for(let i=0;i<14;i++){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()+i);
    const items=episodes.filter(e=>e.scheduled_at&&new Date(e.scheduled_at).toDateString()===d.toDateString());
    const weekly=tasks.filter(t=>t.task_type==="recurring_task"&&t.due_at&&new Date(t.due_at).toDateString()===d.toDateString());
    days.push('<div class="v20-day"><b>'+d.toLocaleDateString(undefined,{weekday:"short"})+'</b><span>'+d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</span>'+(items.length?items.map(x=>'<i>EP · '+esc(x.title)+'</i>').join(""):'')+(weekly.length?weekly.map(x=>'<i class="task">TASK · '+esc(x.title)+'</i>').join(""):'')+(!items.length&&!weekly.length?'<em>Open</em>':'')+'</div>');
  }
  return days.join("");
}
function report(){
  const reports=tasks.filter(x=>x.task_type==="weekly_report").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(!reports.length)return '<div class="v20-empty">No weekly report has been generated yet. The scheduled workflow runs Monday morning and persists the report here.</div>';
  const r=reports[0],p=r.payload||{};
  return '<div class="v20-report"><div class="v20-report-date">'+new Date(r.created_at).toLocaleString()+'</div><div class="v20-report-grid"><b>'+fmt(p.followers)+'<small>Followers</small></b><b>'+fmt(p.subscribers)+'<small>Subscribers</small></b><b>'+fmt(p.catalog_plays)+'<small>Catalog plays</small></b><b>'+fmt(p.published_episodes)+'<small>Published episodes</small></b></div></div>';
}
function alertsHtml(){
  const escalated=tasks.filter(x=>x.task_type==="alert_escalation"&&x.status==="escalated");
  if(!escalated.length&&!alerts.length)return '<div class="v20-empty">No creator alerts recorded.</div>';
  return (escalated.length?'<div class="v20-alert-callout">⚠ '+escalated.length+' alert(s) have been escalated into the workflow queue.</div>':"")+
    alerts.slice(0,8).map(a=>'<div class="v20-alert '+esc(a.severity)+'"><b>'+esc(a.title||a.alert_type||"Creator alert")+'</b><span>'+esc(a.severity)+'</span><p>'+esc(a.message||"")+'</p></div>').join("");
}
async function complete(id){
  const r=await sb.from("podcast_workflow_tasks").update({status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("creator_id",creator);
  if(!r.error){await load();render()}
}
function render(){
  const host=$("dashboard")||document.querySelector("main"); if(!host)return;
  let el=$("v20Workflow"); if(!el){el=document.createElement("section");el.id="v20Workflow";host.appendChild(el)}
  const open=tasks.filter(x=>["open","in_progress","escalated"].includes(x.status)).length;
  const scheduled=episodes.filter(x=>x.status==="scheduled").length;
  const published=episodes.filter(x=>x.status==="published").length;
  const escalations=tasks.filter(x=>x.task_type==="alert_escalation"&&x.status==="escalated").length;
  el.innerHTML='<div class="v20-head"><div><span>V20 · AUTONOMOUS CREATOR WORKFLOW</span><h2>Workflow engine</h2><p>Persistent tasks, scheduled publishing, recurring operations, milestones, escalations and weekly intelligence.</p></div><div class="v20-live">AUTOMATION · '+(sb?"ONLINE":"OFFLINE")+'</div></div>'+
  '<div class="v20-kpis"><div><b>'+open+'</b><small>Open tasks</small></div><div><b>'+scheduled+'</b><small>Scheduled</small></div><div><b>'+published+'</b><small>Published</small></div><div><b>'+escalations+'</b><small>Escalated</small></div></div>'+
  '<div class="v20-grid"><section class="v20-panel"><h3>WORKFLOW QUEUE</h3><div class="v20-list">'+taskRows()+'</div></section>'+
  '<section class="v20-panel"><h3>SCHEDULED PUBLISHING</h3><div class="v20-list">'+scheduleRows()+'</div></section></div>'+
  '<section class="v20-panel"><h3>14-DAY CONTENT CALENDAR</h3><div class="v20-calendar">'+calendar()+'</div></section>'+
  '<div class="v20-grid"><section class="v20-panel"><h3>WEEKLY INTELLIGENCE REPORT</h3>'+report()+'</section><section class="v20-panel"><h3>ALERT ESCALATION</h3>'+alertsHtml()+'</section></div>'+
  '<section class="v20-panel"><h3>AUTOMATION RULES</h3><div class="v20-rules"><span>✓ Scheduled episodes publish automatically</span><span>✓ Weekly planning tasks persist in Supabase</span><span>✓ Audience milestones create durable records</span><span>✓ Aging warning/critical alerts escalate</span><span>✓ Weekly intelligence reports are persisted</span><span>✓ Task completion is account-backed, not browser-local</span></div></section>';
  el.querySelectorAll("[data-v20-complete]").forEach(b=>b.onclick=()=>complete(b.dataset.v20Complete));
}
function realtime(){
  try{
    sb.channel("cr-v20-"+creator)
      .on("postgres_changes",{event:"*",schema:"public",table:"podcast_workflow_tasks",filter:"creator_id=eq."+creator},()=>load().then(render))
      .on("postgres_changes",{event:"*",schema:"public",table:"podcast_episodes"},()=>load().then(render))
      .on("postgres_changes",{event:"*",schema:"public",table:"podcasts"},()=>load().then(render))
      .on("postgres_changes",{event:"*",schema:"public",table:"creator_realtime_alerts",filter:"creator_id=eq."+creator},()=>load().then(render))
      .subscribe();
  }catch{}
  clearInterval(timer); timer=setInterval(()=>load().then(render),60000);
}
window.CROW_V20={init,load,render,complete};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,1600));else setTimeout(init,1600);
})();