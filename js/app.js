const CREATOR_NAV_COLLECTIONS_KEY="crowrules_creator_navigation_collections_v1";
function creatorNavCollectionsRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_COLLECTIONS_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function creatorNavCollectionsWrite(x){try{localStorage.setItem(CREATOR_NAV_COLLECTIONS_KEY,JSON.stringify(x));}catch{}}
function creatorNavCollectionSelect(index){const rows=creatorNavHistoryRead();if(!rows[index])return;rows[index]._selected=!rows[index]._selected;creatorNavHistoryWrite(rows);updateCreatorNavHistoryControls();}
function creatorNavCollectionCreate(){const rows=creatorNavHistoryRead(),selected=rows.filter(x=>x._selected);if(!selected.length){alert("Select at least one snapshot first.");return;}const name=prompt("Collection name:");if(!name||!name.trim())return;const cs=creatorNavCollectionsRead();cs.push({id:"c"+Date.now(),name:name.trim().slice(0,80),snapshotUrls:selected.map(x=>x.url),createdAt:new Date().toISOString()});creatorNavCollectionsWrite(cs);rows.forEach(x=>delete x._selected);creatorNavHistoryWrite(rows);updateCreatorNavHistoryControls();}
function creatorNavCollectionOpen(id){
  creatorNavActivityAdd("collection-open",id,"Opened collection workflow");
  const c=creatorNavCollectionsRead().find(x=>x.id===id);if(!c)return;
  const rows=creatorNavHistoryRead(),targets=c.snapshotUrls.map(u=>rows.find(x=>x.url===u)).filter(Boolean);
  if(!targets.length){alert("No saved snapshots from this collection are available.");return;}
  const target=targets[0];
  try{sessionStorage.setItem("crowrules_creator_collection_runner_v1",JSON.stringify({collectionId:id,index:0}));sessionStorage.setItem("crowrules_creator_nav_restore_v1",JSON.stringify({url:target.url,state:target.state||{}}));}catch{}
  creatorNavActivityAdd("snapshot-open",id,"Opened snapshot: "+creatorNavHistorySnapshotName(target),{url:target.url,index:0});creatorNavHistoryBusy=true;location.href=target.url;
}
function creatorNavCollectionRunner(id,index){
  const c=creatorNavCollectionsRead().find(x=>x.id===id);if(!c)return;
  const rows=creatorNavHistoryRead(),targets=c.snapshotUrls.map(u=>rows.find(x=>x.url===u)).filter(Boolean);
  if(!targets.length){alert("No saved snapshots from this collection are available.");return;}
  const next=Math.max(0,Math.min(Number(index)||0,targets.length-1)),target=targets[next];
  try{sessionStorage.setItem("crowrules_creator_collection_runner_v1",JSON.stringify({collectionId:id,index:next}));sessionStorage.setItem("crowrules_creator_nav_restore_v1",JSON.stringify({url:target.url,state:target.state||{}}));}catch{}
  creatorNavHistoryBusy=true;location.href=target.url;
}
function creatorNavCollectionDashboard(id){
  const c=creatorNavCollectionsRead().find(x=>x.id===id);if(!c)return;
  const rows=creatorNavHistoryRead(),targets=c.snapshotUrls.map(u=>rows.find(x=>x.url===u)).filter(Boolean);
  const progress=creatorNavCollectionProgressRead(),states=progress[c.id]||{};
  const complete=targets.filter(e=>states[e.url]==="complete").length,pct=targets.length?Math.round(complete/targets.length*100):0,m=creatorNavCollectionMilestoneUpdate(c.id,targets),ai=creatorNavActivityIntelligence(c.id);
  const html='<div class="section wrap"><div class="card" style="padding:16px"><div style="font-size:.75rem;letter-spacing:.08em;opacity:.7">COLLECTION DASHBOARD</div><h2 style="margin:.25rem 0">'+esc(c.name)+'</h2><div>Progress: '+complete+'/'+targets.length+' Complete — '+pct+'%</div><div style="margin-top:12px"><strong>MILESTONES</strong><div style="font-size:.85rem;margin-top:5px">'+m.events.map(e=>esc(e.label)+' · '+creatorNavCollectionMilestoneDate(e.at)).join(' → ')+'</div><div style="font-size:.8rem;opacity:.7;margin-top:5px">Started: '+creatorNavCollectionMilestoneDate(m.startedAt)+' · Completed: '+creatorNavCollectionMilestoneDate(m.completedAt)+'</div></div><div style="height:8px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden;margin:8px 0 14px"><div style="height:100%;width:'+pct+'%;background:currentColor"></div></div>'+targets.map((e,n)=>{const st=states[e.url]||"not-started",name=creatorNavHistorySnapshotName(e);return '<div class="card" style="padding:10px;margin-top:8px;display:flex;justify-content:space-between;gap:10px;align-items:center"><div><strong>'+(n+1)+'. '+esc(name)+'</strong><div style="font-size:.8rem;opacity:.7">'+esc(st.replace("-"," "))+'</div></div><div class="actions"><button class="btn" onclick="creatorNavCollectionRunner(\''+c.id+'\','+n+')">OPEN</button><button class="btn" onclick="creatorNavCollectionDashboardStatus(\''+c.id+'\','+n+',\'complete\')">COMPLETE</button></div></div>';}).join("")+'</div></div>';
  let host=document.getElementById("creatorNavCollectionDashboard");if(!host){host=document.createElement("div");host.id="creatorNavCollectionDashboard";const h=document.getElementById("creatorNavCollectionsPanel");if(h)h.parentNode.insertBefore(host,h);}host.innerHTML=html;
}
function creatorNavActivityDashboardFilter(id,filter){
  const host=document.getElementById("creatorNavActivityList_"+id);if(!host)return;
  const events=creatorNavActivityFilter(id,filter).slice(0,25);
  host.innerHTML=events.length?events.map(a=>'<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)"><div>'+esc(a.message)+'</div><div style="font-size:.75rem;opacity:.65">'+esc(creatorNavActivityDate(a.at))+'</div></div>').join(""):'<div style="opacity:.7">No matching activity.</div>';
}
function creatorNavCollectionDashboardStatus(id,index,status){
  const c=creatorNavCollectionsRead().find(x=>x.id===id);if(!c)return;
  const rows=creatorNavHistoryRead(),targets=c.snapshotUrls.map(u=>rows.find(x=>x.url===u)).filter(Boolean),e=targets[index];if(!e)return;
  creatorNavCollectionProgressSet(id,e.url,status);creatorNavActivityAdd("status-change",id,"Marked “"+creatorNavHistorySnapshotName(e)+"” as "+status,{url:e.url,status});creatorNavCollectionsHost();
}
function creatorNavCollectionMilestonesRead(){try{return JSON.parse(localStorage.getItem("crowrules_creator_collection_milestones_v1")||"{}");}catch{return {};}}
function creatorNavCollectionMilestonesWrite(x){try{localStorage.setItem("crowrules_creator_collection_milestones_v1",JSON.stringify(x));}catch{}}
function creatorNavCollectionMilestoneUpdate(id,targets){
  const all=creatorNavCollectionMilestonesRead(),m=all[id]||{events:[]},p=creatorNavCollectionProgressRead(),st=p[id]||{};
  const complete=targets.filter(e=>st[e.url]==="complete").length,total=targets.length,pct=total?Math.round(complete/total*100):0;
  const thresholds=[[0,"Started"],[25,"25%"],[50,"50%"],[75,"75%"],[100,"Completed"]];
  m.events=m.events||[];
  if(!m.startedAt&&targets.length)m.startedAt=new Date().toISOString();
  thresholds.forEach(([n,label])=>{if(pct>=n&&!m.events.some(e=>e.label===label)){m.events.push({label,at:new Date().toISOString()});}});
  if(pct===100&&!m.completedAt)m.completedAt=new Date().toISOString();
  all[id]=m;creatorNavCollectionMilestonesWrite(all);return m;
}
function creatorNavCollectionMilestoneDate(iso){if(!iso)return "—";try{return new Date(iso).toLocaleString([], {dateStyle:"medium",timeStyle:"short"});}catch{return iso;}}
const CREATOR_NAV_ACTIVITY_KEY="crowrules_creator_collection_activity_v1";
function creatorNavActivityRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_ACTIVITY_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function creatorNavActivityWrite(x){try{localStorage.setItem(CREATOR_NAV_ACTIVITY_KEY,JSON.stringify(x.slice(-200)));}catch{}}
function creatorNavActivityAdd(type,id,message,meta){const x=creatorNavActivityRead();x.push({id:"a"+Date.now(),type,collectionId:id,message,meta:meta||{},at:new Date().toISOString()});creatorNavActivityWrite(x);}
function creatorNavCollectionHealth(id){
  const c=creatorNavCollectionsRead().find(x=>x.id===id);if(!c)return null;
  const rows=creatorNavHistoryRead(),targets=c.snapshotUrls.map(u=>rows.find(x=>x.url===u)).filter(Boolean),p=creatorNavCollectionProgressRead()[id]||{},ai=creatorNavActivityIntelligence(id),m=creatorNavCollectionMilestonesRead()[id]||{events:[]};
  const complete=targets.filter(e=>p[e.url]==="complete").length,inProgress=targets.filter(e=>p[e.url]==="in-progress").length,notStarted=targets.length-complete-inProgress,pct=targets.length?Math.round(complete/targets.length*100):0;
  const last=ai.lastActivity?new Date(ai.lastActivity).getTime():0,stale=last?Date.now()-last>7*86400000:true;
  const health=pct===100?"Complete":stale?"Stale":inProgress>0?"Active":"Not Started";
  return {c,targets,complete,inProgress,notStarted,pct,ai,m,stale,health};
}
function creatorNavCollectionAlerts(id){
  const h=creatorNavCollectionHealth(id);if(!h)return [];
  const now=Date.now(),last=h.ai.lastActivity?new Date(h.ai.lastActivity).getTime():0,age=last?Math.floor((now-last)/86400000):null,alerts=[];
  if(h.pct===100)return alerts;
  if(h.stale)alerts.push({type:"stale-workflow",severity:"WARNING",title:"Stale Workflow",message:last?"No activity for "+age+" day(s).":"No activity has been recorded yet.",action:"OPEN DASHBOARD",fn:"creatorNavCollectionDashboard('"+h.c.id+"')"});
  else if(h.inProgress>0&&last&&now-last>3*86400000)alerts.push({type:"no-recent-activity",severity:"ATTENTION",title:"No Recent Activity",message:"The active workflow has no activity in the last 3 days.",action:"OPEN DASHBOARD",fn:"creatorNavCollectionDashboard('"+h.c.id+"')"});
  const blocked=h.targets.find(e=>h.ai.events.some(a=>a.type==="status-change"&&a.meta&&a.meta.url===e.url&&a.meta.status==="in-progress")&&!h.ai.events.some(a=>a.type==="status-change"&&a.meta&&a.meta.url===e.url&&a.meta.status==="complete"));
  if(blocked){const idx=h.targets.indexOf(blocked),ev=h.ai.events.filter(a=>a.type==="status-change"&&a.meta&&a.meta.url===blocked.url&&a.meta.status==="in-progress"),started=ev.length?new Date(ev[ev.length-1].at).getTime():0;if(started&&now-started>3*86400000)alerts.push({type:"blocked-step",severity:"ATTENTION",title:"Blocked Step",message:"“"+creatorNavHistorySnapshotName(blocked)+"” has been in progress for more than 3 days.",action:"OPEN STEP",fn:"creatorNavCollectionRunner('"+h.c.id+"',"+idx+")"});}
  const started=h.m.startedAt?new Date(h.m.startedAt).getTime():0;
  if(started&&now-started>7*86400000&&h.pct<50)alerts.push({type:"completion-behind",severity:"ATTENTION",title:"Completion Falling Behind",message:"Started more than 7 days ago and remains below 50% complete.",action:"OPEN WORKFLOW",fn:"creatorNavCollectionRunner('"+h.c.id+"',"+Math.min(h.complete,Math.max(0,h.targets.length-1))+")"});
  return alerts;
}
const CREATOR_NAV_HEALTH_ALERTS_KEY="crowrules_creator_health_alerts_v1";
function creatorNavHealthAlertStateRead(){try{return JSON.parse(localStorage.getItem(CREATOR_NAV_HEALTH_ALERTS_KEY)||"{}");}catch{return {};}}
function creatorNavHealthAlertStateWrite(x){try{localStorage.setItem(CREATOR_NAV_HEALTH_ALERTS_KEY,JSON.stringify(x));}catch{}}
function creatorNavHealthAlertKey(id,type){return id+"::"+type;}
function creatorNavHealthAlertIsDismissed(id,type){return !!creatorNavHealthAlertStateRead()[creatorNavHealthAlertKey(id,type)]?.dismissed;}
function creatorNavHealthAlertSetDismissed(id,type,value){const x=creatorNavHealthAlertStateRead(),k=creatorNavHealthAlertKey(id,type);x[k]={dismissed:!!value,at:new Date().toISOString()};creatorNavHealthAlertStateWrite(x);}
function creatorNavHealthAlertAcknowledge(id,type){creatorNavHealthAlertSetDismissed(id,type,true);creatorNavActivityAdd("alert-ack",id,"Acknowledged health alert: "+type,{alertType:type});creatorNavCollectionHealthAlertsRender();}
function creatorNavHealthAlertRestore(id,type){creatorNavHealthAlertSetDismissed(id,type,false);creatorNavActivityAdd("alert-restore",id,"Restored health alert: "+type,{alertType:type});creatorNavCollectionHealthAlertsRender();}
function creatorNavHealthAlertHistory(){return creatorNavActivityRead().filter(e=>e.type==="alert-ack"||e.type==="alert-restore").sort((a,b)=>new Date(b.at)-new Date(a.at));}
function creatorNavForecastAnalytics(id,f,t){
  const rows=t?.history||[],recent=rows.slice(-8);
  let actual=0,predicted=0,errors=[];
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i],n=rows[i+1],days=Math.max(1,(new Date(n.day)-new Date(a.day))/86400000),v=Number(a.velocity)||0,p=Math.min(100,a.pct+v*days);
    predicted+=p;actual+=n.pct;errors.push(Math.abs(p-n.pct));
  }
  const accuracy=errors.length?Math.max(0,Math.round(100-(errors.reduce((a,b)=>a+b,0)/errors.length))):null;
  const milestoneTotal=Math.max(1,(creatorNavCollectionHealth(id)?.milestones||[]).length),milestones=f.milestoneCount;
  const milestonePct=Math.round(milestones/milestoneTotal*100);
  return {recent,accuracy,predicted,actual,errors,milestonePct,milestones,milestoneTotal};
}
function creatorNavCreatorHealthIndex(data){
  if(!data.length)return 0;
  const weights={AT_RISK:35,"NEEDS ATTENTION":55,"LIKELY TO COMPLETE":90};
  return Math.round(data.reduce((sum,x)=>{const trend=x.t.direction==="IMPROVING"?10:x.t.direction==="DECLINING"?-10:0;return sum+Math.max(0,Math.min(100,(weights[x.f.status]||50)+trend+(x.f.pct>=75?10:0)));},0)/data.length);
}
const CREATOR_NAV_ROADMAP_KEY="crowrules_creator_roadmaps_v1",CREATOR_NAV_SCENARIOS_KEY="crowrules_creator_saved_scenarios_v1",CREATOR_NAV_EXECUTION_KEY="crowrules_creator_execution_v1",CREATOR_NAV_TEAM_KEY="crowrules_creator_team_v1";
function creatorNavPlanningRead(){try{return JSON.parse(localStorage.getItem(CREATOR_NAV_ROADMAP_KEY)||"{}");}catch{return {};}}
function creatorNavPlanningWrite(x){try{localStorage.setItem(CREATOR_NAV_ROADMAP_KEY,JSON.stringify(x));}catch{}}
function creatorNavPlanSave(id,plan){const all=creatorNavPlanningRead();all[id]={...(all[id]||{}),...plan,savedAt:new Date().toISOString()};creatorNavPlanningWrite(all);creatorNavEvent("deadline-change",{collectionId:id,targetDate:plan?.targetDate||null});}
function creatorNavPlanGet(id){return creatorNavPlanningRead()[id]||null;}
function creatorNavPlanTarget(id){
  const p=creatorNavPlanGet(id);if(!p?.targetDate)return null;
  const target=new Date(p.targetDate+"T23:59:59").getTime(),remaining=Math.max(0,100-(Number(p.pct)||0)),ms=target-Date.now(),days=Math.ceil(Math.max(0,ms)/86400000);
  return {targetDate:p.targetDate,days,requiredVelocity:days>0?Math.round(remaining/days*10)/10:remaining,remaining,countdownMs:ms};
}
function creatorNavPlanCompare(f,target){
  if(!target)return {state:"NO TARGET",delta:null};
  if(f.pct>=100)return {state:"AHEAD",delta:f.velocity};
  const delta=Math.round((f.velocity-target.requiredVelocity)*10)/10;
  return {state:delta>0.1?"AHEAD":delta<-0.1?"BEHIND":"ON TRACK",delta};
}
function creatorNavSavedScenariosRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_SCENARIOS_KEY)||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}}
function creatorNavSavedScenariosWrite(x){try{localStorage.setItem(CREATOR_NAV_SCENARIOS_KEY,JSON.stringify(x));}catch{}}
function creatorNavScenarioSave(id,name,rate){
  const all=creatorNavSavedScenariosRead(),rows=Array.isArray(all[id])?all[id]:[];
  rows.push({id:"s"+Date.now(),name:String(name||"Scenario"),rate:Math.max(0,Number(rate)||0),savedAt:new Date().toISOString()});
  all[id]=rows.slice(-12);creatorNavSavedScenariosWrite(all);
}
function creatorNavScenarioDelete(id,sid){const all=creatorNavSavedScenariosRead();all[id]=(all[id]||[]).filter(x=>x.id!==sid);creatorNavSavedScenariosWrite(all);}
function creatorNavExecutionRead(){try{return JSON.parse(localStorage.getItem(CREATOR_NAV_EXECUTION_KEY)||"{}");}catch{return {};}}
function creatorNavExecutionWrite(x){try{localStorage.setItem(CREATOR_NAV_EXECUTION_KEY,JSON.stringify(x));}catch{}}
function creatorNavExecutionGet(id){const x=creatorNavExecutionRead();return x[id]||{tasks:{},history:[],streak:0,lastDay:null};}
function creatorNavExecutionToggle(id,key,done,name){
  const all=creatorNavExecutionRead(),x=all[id]||{tasks:{},history:[],streak:0,lastDay:null};
  x.tasks[key]=!!done;x.history=x.history||[];x.history.push({key,name,done:!!done,at:new Date().toISOString()});creatorNavEvent(done?"completion":"task-reopened",{collectionId:id,key,name,done:!!done});x.history=x.history.slice(-100);
  const today=new Date().toISOString().slice(0,10);
  if(done&&x.lastDay!==today){x.streak=(x.lastDay&&((Date.now()-new Date(x.lastDay+"T00:00:00").getTime())/86400000)<=1)?(x.streak||0)+1:1;x.lastDay=today;}
  all[id]=x;creatorNavExecutionWrite(all);
}
function creatorNavTodayPlan(x,target){
  const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,target),remaining=steps.filter(s=>!s.done),daily=target?target.requiredVelocity:Math.max(.1,x.f.velocity||0),count=Math.max(1,Math.ceil(daily));
  return {steps,remaining,today:remaining.slice(0,count),daily,weekly:Math.round(daily*7*10)/10,streak:ex.streak||0,history:ex.history||[]};
}
function creatorNavTeamRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_TEAM_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function creatorNavTeamWrite(x){try{localStorage.setItem(CREATOR_NAV_TEAM_KEY,JSON.stringify(x.slice(0,50)));}catch{}}
function creatorNavTeamEnsure(){let t=creatorNavTeamRead();if(!t.length){t=[{id:"me",name:"Me",capacity:4,active:true}];creatorNavTeamWrite(t);}return t;}
function creatorNavAssign(id,key,memberId){const all=creatorNavExecutionRead(),x=all[id]||{tasks:{},history:[],streak:0,lastDay:null,assignments:{},handoffs:[]};x.assignments=x.assignments||{};x.assignments[key]=memberId;x.history=x.history||[];x.history.push({type:"assignment",key,memberId,at:new Date().toISOString()});creatorNavEvent("assignment",{collectionId:id,key,memberId});x.history=x.history.slice(-100);all[id]=x;creatorNavExecutionWrite(all);}
function creatorNavHandoff(id,key,from,to){const all=creatorNavExecutionRead(),x=all[id]||{tasks:{},history:[],streak:0,lastDay:null,assignments:{},handoffs:[]};x.handoffs=x.handoffs||[];x.handoffs.push({key,from,to,at:new Date().toISOString()});x.history=x.history||[];x.history.push({type:"handoff",key,from,to,at:new Date().toISOString()});x.history=x.history.slice(-100);all[id]=x;creatorNavExecutionWrite(all);}
function creatorNavTeamMemberSave(id,name,role,capacity,active=true){const t=creatorNavTeamEnsure();const i=t.findIndex(m=>m.id===id);const m={id:id||("m"+Date.now()),name:String(name||"Creator").trim()||"Creator",role:String(role||"Creator").trim()||"Creator",capacity:Math.max(0,Number(capacity)||0),active:active!==false};if(i<0)t.push(m);else t[i]={...t[i],...m};creatorNavTeamWrite(t);creatorNavEvent("capacity-change",{memberId:m.id,name:m.name,capacity:m.capacity,active:m.active});return m;}
function creatorNavTeamMemberDelete(id){let t=creatorNavTeamEnsure();if(t.length<=1)return;t=t.filter(m=>m.id!==id);creatorNavTeamWrite(t);}
function creatorNavScheduleSuggestions(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),used=team.map(m=>({member:m,load:0,tasks:[]}));
  const suggestions=[];
  data.forEach(x=>{
    const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,x.target);
    steps.forEach((st,i)=>{
      if(st.done)return;
      const ownerId=ex.assignments?.[st.key],owner=team.find(m=>m.id===ownerId);
      const blocked=i>0&&!steps[i-1].done;
      const target=x.target?.targetDate?new Date(x.target.targetDate+"T23:59:59"):null;
      const candidates=used.filter(r=>!blocked||true).sort((a,b)=>a.load-b.load);
      const best=candidates[0];
      if(best&&(!ownerId||!owner||used.find(r=>r.member.id===ownerId)?.load>Number(owner.capacity||0))){
        if(!ownerId||best.member.id!==ownerId)suggestions.push({collectionId:x.c.id,key:st.key,name:st.name,collection:x.c.name,from:owner?.name||"Unassigned",to:best.member.name,memberId:best.member.id,blocked,deadline:target?target.toISOString().slice(0,10):null});
      }
      const assigned=used.find(r=>r.member.id===ownerId)||best;if(assigned)assigned.load++;
    });
  });
  return {suggestions,teamLoad:used};
}
function creatorNavApplySchedule(id,key,memberId){creatorNavAssign(id,key,memberId);}
const CREATOR_NAV_EVENTS_KEY="crowrules_creator_production_events_v1";
function creatorNavEventsRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_EVENTS_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function creatorNavEventsWrite(x){try{localStorage.setItem(CREATOR_NAV_EVENTS_KEY,JSON.stringify(x.slice(-300)));}catch{}}
const CREATOR_NAV_SYNC_KEY="crowrules_creator_live_sync_v1";
let creatorNavSyncTimer=null,creatorNavSyncSignature="";
function creatorNavSyncRead(){try{return JSON.parse(localStorage.getItem(CREATOR_NAV_SYNC_KEY)||"{}");}catch{return {};}}
function creatorNavSyncWrite(x){try{localStorage.setItem(CREATOR_NAV_SYNC_KEY,JSON.stringify(x));}catch{}}
function creatorNavSyncSignatureGet(data){
  const team=creatorNavTeamEnsure().map(m=>({id:m.id,capacity:m.capacity,active:m.active})),events=creatorNavEventsRead();
  return JSON.stringify({team,events:events.length,last:events.length?events[events.length-1].id:null,data:data.map(x=>({id:x.c.id,target:x.target?.targetDate||null,execution:creatorNavExecutionGet(x.c.id)}))});
}
function creatorNavSyncRefresh(){
  if(typeof data==="undefined")return;
  const sig=creatorNavSyncSignatureGet(data);if(sig===creatorNavSyncSignature)return;
  creatorNavSyncSignature=sig;creatorNavSyncWrite({updatedAt:new Date().toISOString(),signature:sig});
  renderCalendar?.(14);renderScheduler?.();renderProductionBoard?.();renderAdaptiveSchedule?.();renderProductionControlRoom?.();renderProductionEventStream?.();renderProductionIntelligence?.();renderCreatorPerformanceIntelligence?.();renderIntelligentAssignments?.();renderAutonomousOptimizer?.();renderOptimizationSimulatorPanel?.();renderScenarioWorkspace?.();renderScenarioComparisonMatrix?.();renderScenarioApprovalEngine?.();renderChangeManagement?.();renderProductionTransactionConsole?.();renderTransactionSafety?.();renderTransactionTimeline?.();renderTransactionForensics?.();renderAuditCompliance?.();renderCryptographicGovernance?.();renderIdentityGovernance?.();
}
function creatorNavSyncStart(){
  if(creatorNavSyncTimer)return;
  creatorNavSyncSignature=creatorNavSyncSignatureGet(data);
  creatorNavSyncTimer=setInterval(creatorNavSyncRefresh,1000);
  window.addEventListener("storage",e=>{if(e.key===CREATOR_NAV_EVENTS_KEY||e.key===CREATOR_NAV_TEAM_KEY||e.key===CREATOR_NAV_EXECUTION_KEY||e.key===CREATOR_NAV_ROADMAP_KEY)creatorNavSyncRefresh();});
}
function creatorNavEvent(type,payload){
  const rows=creatorNavEventsRead(),e={id:"ev"+Date.now()+"_"+Math.random().toString(36).slice(2,7),type:String(type||"change"),at:new Date().toISOString(),...payload};
  rows.push(e);creatorNavEventsWrite(rows);return e;
}
function creatorNavEventTypeLabel(type){return String(type||"change").replace(/[-_]/g," ").replace(/\b\w/g,m=>m.toUpperCase());}
function creatorNavControlRoomState(data){
  const adaptive=creatorNavAdaptiveSchedule(data),team=creatorNavTeamEnsure(),workload=creatorNavTeamWorkload(data);
  const handoffs=[],activity=[];
  data.forEach(x=>{const ex=creatorNavExecutionGet(x.c.id);(ex.handoffs||[]).slice(-10).forEach(h=>handoffs.push({...h,collection:x.c.name}));(ex.history||[]).slice(-20).forEach(h=>activity.push({...h,collection:x.c.name}));});
  return {adaptive,team,workload,handoffs:handoffs.slice(-20),activity:activity.slice(-40)};
}
function creatorNavAdaptiveSchedule(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),out=[],conflicts=[],now=new Date();now.setHours(0,0,0,0);
  data.forEach(x=>{
    const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,x.target),rows=[];
    let cursor=new Date(now);
    steps.forEach((st,i)=>{
      if(st.done)return;
      const dep=creatorNavDependencyStatus(x,st,i),owner=team.find(m=>m.id===ex.assignments?.[st.key])||null;
      const capacity=owner?Math.max(1,Number(owner.capacity)||1):1;
      const scheduled=new Date(cursor);scheduled.setDate(scheduled.getDate()+Math.floor(rows.length/capacity));
      const deadline=x.target?.targetDate?new Date(x.target.targetDate+"T23:59:59"):null;
      const daysToDeadline=deadline?Math.ceil((deadline-scheduled)/86400000):null;
      const status=daysToDeadline!==null?(daysToDeadline<0?"OVERDUE":daysToDeadline<=2?"AT RISK":"ON TIME"):"NO DEADLINE";
      rows.push({key:st.key,name:st.name,owner,date:scheduled,dependency:dep,state:status,daysToDeadline});
      if(status==="OVERDUE"||status==="AT RISK")conflicts.push({collection:x.c.name,task:st.name,owner:owner?.name||"Unassigned",status,daysToDeadline});
    });
    out.push({id:x.c.id,name:x.c.name,rows});
  });
  const recovery=conflicts.map(c=>({...c,action:c.status==="OVERDUE"?"Prioritize immediately":"Move ahead of lower-priority work"}));
  return {collections:out,conflicts,recovery};
}
function creatorNavAdaptiveSummary(a){return {tasks:a.collections.reduce((n,c)=>n+c.rows.length,0),conflicts:a.conflicts.length,overdue:a.conflicts.filter(c=>c.status==="OVERDUE").length,recovery:a.recovery.length};}
function creatorNavScheduleDate(x,step,index){
  const steps=creatorNavRoadmapSteps(x,x.target),prev=index>0?steps[index-1]:null;
  const base=new Date();base.setHours(0,0,0,0);
  if(prev&&!prev.done){const d=prev.projected&&prev.projected!=="—"?new Date(prev.projected):base;d.setHours(0,0,0,0);d.setDate(d.getDate()+1);return d;}
  const d=step.projected&&step.projected!=="—"?new Date(step.projected):base;d.setHours(0,0,0,0);return d;
}
function creatorNavDependencyStatus(x,step,index){
  const steps=creatorNavRoadmapSteps(x,x.target),prev=index>0?steps[index-1]:null;
  if(!prev)return {state:"READY",reason:"No dependency"};
  if(!prev.done)return {state:"BLOCKED",reason:"Waiting for "+prev.name};
  return {state:"READY",reason:"Dependency complete"};
}
function creatorNavDeadlineStatus(x,date){
  if(!x.target?.targetDate)return {state:"NO DEADLINE",days:null};
  const d=new Date(x.target.targetDate+"T23:59:59"),days=Math.ceil((d-date)/86400000);
  return {state:days<0?"OVERDUE":days<=2?"AT RISK":"ON TIME",days};
}
function creatorNavOptimizedSequence(data){
  const out=[];
  data.forEach(x=>{
    const steps=creatorNavRoadmapSteps(x,x.target),ex=creatorNavExecutionGet(x.c.id);
    const remaining=steps.map((st,i)=>({st,i,dep:creatorNavDependencyStatus(x,st,i),date:creatorNavScheduleDate(x,st,i)})).filter(r=>!r.st.done);
    remaining.sort((a,b)=>{const da=a.dep.state==="BLOCKED"?1:0,db=b.dep.state==="BLOCKED"?1:0;return da-db||a.date-b.date;});
    out.push({collection:x.c.name,id:x.c.id,steps:remaining.map(r=>({...r,owner:creatorNavTeamEnsure().find(m=>m.id===ex.assignments?.[r.st.key])||null,deadline:creatorNavDeadlineStatus(x,r.date)}))});
  });return out;
}
function creatorNavBoardRead(){try{const x=JSON.parse(localStorage.getItem("crowrules_creator_board_v1")||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}}
function creatorNavBoardWrite(x){try{localStorage.setItem("crowrules_creator_board_v1",JSON.stringify(x));}catch{}}
function creatorNavBoardMove(id,key,memberId){
  const all=creatorNavBoardRead();all[id]=all[id]||{};all[id][key]={memberId:String(memberId||""),movedAt:new Date().toISOString()};creatorNavBoardWrite(all);
  creatorNavAssign(id,key,memberId);
}
function creatorNavBoardRecalculate(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),load={};team.forEach(m=>load[m.id]=0);
  const changes=[];
  data.forEach(x=>{const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,x.target);
    steps.forEach((st,i)=>{if(st.done)return;const blocked=i>0&&!steps[i-1].done;let mid=ex.assignments?.[st.key];
      if(!mid||!team.some(m=>m.id===mid)){const pick=team.slice().sort((a,b)=>(load[a.id]||0)-(load[b.id]||0))[0];if(pick){mid=pick.id;creatorNavBoardMove(x.c.id,st.key,mid);changes.push(st.name+" → "+pick.name);}}
      if(mid)load[mid]=(load[mid]||0)+1;
    });
  }); return {load,changes};
}
function creatorNavProductionCalendar(data,days=14){
  const team=creatorNavTeamEnsure(),today=new Date();today.setHours(0,0,0,0);
  const rows=[];
  data.forEach(x=>{
    const ex=creatorNavExecutionGet(x.c.id);
    creatorNavRoadmapSteps(x,x.target).forEach((st,i)=>{
      const owner=team.find(m=>m.id===ex.assignments?.[st.key])||null;
      const d=st.projected==="—"?null:new Date(st.projected);
      if(d&&!Number.isNaN(d.getTime()))rows.push({collection:x.c.name,collectionId:x.c.id,key:st.key,name:st.name,owner,done:st.done,dependency:st.dependency,date:d,target:x.target?.targetDate||null,blocked:i>0&&!creatorNavRoadmapSteps(x,x.target)[i-1].done});
    });
  });
  return {rows:rows.sort((a,b)=>a.date-b.date),team,today,days};
}
function creatorNavTeamWorkload(data){const t=creatorNavTeamEnsure(),rows=t.map(m=>({member:m,tasks:[],load:0}));data.forEach(x=>{const ex=creatorNavExecutionGet(x.c.id);creatorNavRoadmapSteps(x,x.target).forEach(st=>{if(st.done)return;const mid=ex.assignments?.[st.key];const r=rows.find(z=>z.member.id===mid);if(r){r.tasks.push({...st,collection:x.c.name});r.load++;}});});return rows.map(r=>({...r,over:r.load>Number(r.member.capacity||0)}));}
function creatorNavTeamCapacity(){return creatorNavTeamEnsure().filter(m=>m.active!==false).reduce((n,m)=>n+Math.max(0,Number(m.capacity)||0),0);}
function creatorNavPlanRecommendations(f,target,cmp){
  const out=[];
  if(!target)out.push("Set a target completion date to activate deadline planning.");
  else if(cmp.state==="BEHIND")out.push("Increase planned velocity to at least "+target.requiredVelocity+" pts/day.");
  if(f.earlyWarning==="ACTIVITY GAP")out.push("Schedule a focused production session to restore activity.");
  if(f.earlyWarning==="LOW VELOCITY")out.push("Complete the next workflow step before expanding scope.");
  if(f.earlyWarning==="LONG ETA")out.push("Use the accelerated scenario or move the target date.");
  if(f.milestoneRemaining>0)out.push("Prioritize the next incomplete roadmap step.");
  if(!out.length)out.push("Maintain the current pace and review the roadmap after the next milestone.");
  return out;
}
function creatorNavRoadmapSteps(x,target){
  const total=x.c.targets.length,complete=x.f.pct,rate=x.f.velocity;
  return x.c.targets.map((snap,i)=>{
    const threshold=total?Math.round((i+1)/total*100):100,done=i< x.f.complete;
    const remaining=Math.max(0,threshold-complete),days=rate>0?Math.ceil(remaining/rate):null;
    const projected=days===null?"—":new Date(Date.now()+days*86400000).toLocaleDateString([], {dateStyle:"medium"});
    const dependency=i?"Step "+i+" completion":"Project start";
    return {i,key:String(snap.url||i),name:creatorNavHistorySnapshotName(snap),threshold,done,dependency,projected};
  });
}
function creatorNavRecoveryPlan(x,target,cmp){
  if(!target||cmp.state!=="BEHIND")return null;
  const required=target.requiredVelocity,boost=Math.max(required,x.f.velocity)*1.25,recoveryDays=boost>0?Math.ceil(Math.max(0,100-x.f.pct)/boost):null;
  return {rate:Math.round(boost*10)/10,days:recoveryDays,target:target.targetDate,message:"Temporary recovery pace: "+Math.round(boost*10)/10+" pts/day until the roadmap returns to target trajectory."};
}
function creatorNavForecastDashboardRender(){
  const host=document.getElementById("creatorNavForecastDashboard");if(!host)return;
  const cs=creatorNavCollectionsRead(),data=cs.map(c=>{const f=creatorNavCollectionForecast(c.id),t=creatorNavForecastTrend(c.id,f),a=creatorNavForecastAnalytics(c.id,f),target=creatorNavPlanTarget(c.id),cmp=creatorNavPlanCompare(f,target);return {c,f,t,a,target,cmp};});
  const sum=creatorNavPredictiveSummary(data),index=creatorNavCreatorHealthIndex(data),escText=x=>esc(String(x??"")),fmtEta=d=>d===null?"Unknown":d===0?"Complete":d+" day(s)"; const team=creatorNavTeamEnsure(),workload=creatorNavTeamWorkload(data);
  const queue=data.filter(x=>x.f.earlyWarning||x.f.status==="AT RISK"||x.cmp.state==="BEHIND").sort((a,b)=>(a.cmp.state==="BEHIND"?3:0)+(a.f.earlyWarning?2:0)-(b.cmp.state==="BEHIND"?3:0)-(b.f.earlyWarning?2:0));
  host.innerHTML='<div class="card" style="padding:14px"><div style="font-size:.75rem;letter-spacing:.08em;opacity:.7">PREDICTIVE COMMAND CENTER 5.0</div><h2 style="margin:.25rem 0">TEAM PRODUCTION ENGINE · HEALTH '+index+'/100</h2><div style="font-size:.84rem;opacity:.75">Coordinate task ownership, team capacity, dependencies, handoffs, and production execution.</div>'+
  '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:12px"><div class="card" style="padding:10px"><b>COLLECTIONS</b><div style="font-size:1.2rem">'+sum.total+'</div></div><div class="card" style="padding:10px"><b>TODAY QUEUE</b><div style="font-size:1.2rem">'+data.reduce((n,x)=>n+creatorNavTodayPlan(x,x.target).today.length,0)+'</div></div><div class="card" style="padding:10px"><b>RECOVERY QUEUE</b><div style="font-size:1.2rem">'+queue.length+'</div></div><div class="card" style="padding:10px"><b>CONFIDENCE</b><div style="font-size:1.2rem">'+sum.confidence+'%</div></div></div>'+
  '<div style="margin-top:16px"><strong>CREATOR TEAM MANAGER</strong><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+workload.map(r=>'<div class="card" style="padding:9px;min-width:180px"><b>'+escText(r.member.name)+'</b><div style="font-size:.75rem">'+escText(r.member.role||"Creator")+' · Capacity '+Number(r.member.capacity||0)+'/day</div><div style="font-size:.8rem;margin-top:4px">'+r.load+' assigned task(s)'+(r.over?' · OVER CAPACITY':'')+'</div><input data-team-name="'+escText(r.member.id)+'" value="'+escText(r.member.name)+'" style="width:100%;margin-top:5px"><input data-team-role="'+escText(r.member.id)+'" value="'+escText(r.member.role||"Creator")+'" style="width:100%;margin-top:4px"><input data-team-capacity="'+escText(r.member.id)+'" type="number" min="0" step=".5" value="'+Number(r.member.capacity||0)+'" style="width:100%;margin-top:4px"><button type="button" data-team-save="'+escText(r.member.id)+'" style="margin-top:5px">SAVE</button> <button type="button" data-team-delete="'+escText(r.member.id)+'">REMOVE</button></div>').join("")+'<button type="button" id="teamAdd">+ ADD CREATOR</button></div></div><div style="margin-top:16px"><strong>SHARED PRODUCTION CALENDAR</strong><div class="card" style="padding:10px;margin-top:7px"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button type="button" id="calendar14">14-DAY VIEW</button><button type="button" id="calendar30">30-DAY VIEW</button></div><div id="creatorNavProductionCalendarGrid"></div><div id="creatorNavScheduler"></div><div style="margin-top:10px"><b>PRODUCTION BOARD</b><button type="button" id="boardRebalance" style="margin-left:8px">AUTO-BALANCE</button><div id="creatorNavProductionBoard"></div><div class="card" style="padding:8px;margin-top:10px"><b>REAL-TIME PRODUCTION CONTROL ROOM</b><div id="creatorNavLiveControlRoom"></div><div style="margin-top:10px"><b>LIVE EVENT STREAM</b><div id="creatorNavLiveEventStream"></div><div class="card" style="padding:8px;margin-top:10px"><b>PRODUCTION INTELLIGENCE DASHBOARD</b><div id="creatorNavProductionIntelligence"></div><div style="margin-top:10px"><b>CREATOR PERFORMANCE INTELLIGENCE</b><div id="creatorNavCreatorPerformance"></div><div style="margin-top:10px"><b>INTELLIGENT WORK ASSIGNMENT ENGINE</b><div id="creatorNavIntelligentAssignments"></div><div style="margin-top:10px"><b>AUTONOMOUS PRODUCTION OPTIMIZER</b><div id="creatorNavAutonomousOptimizer"></div><div style="margin-top:10px"><b>OPTIMIZATION SIMULATOR & WHAT-IF ENGINE</b><div id="creatorNavOptimizationSimulator"></div><div style="margin-top:10px"><b>SCENARIO WORKSPACE & DECISION ENGINE</b><div id="creatorNavScenarioWorkspace"></div><div style="margin-top:10px"><b>SCENARIO COMPARISON MATRIX</b><div id="creatorNavScenarioComparison"></div><div style="margin-top:10px"><b>SCENARIO DECISION & APPROVAL ENGINE</b><div id="creatorNavScenarioApproval"></div><div style="margin-top:10px"><b>PRODUCTION CHANGE MANAGEMENT</b><div id="creatorNavChangeManagement"></div><div style="margin-top:10px"><div id="creatorNavTransactionConsole"></div><div id="creatorNavTransactionSafety"></div><div id="creatorNavTransactionTimeline"></div><div id="creatorNavTransactionForensics"></div><div id="creatorNavAuditCompliance"></div><div id="creatorNavCryptoGovernance"></div><div id="creatorNavIdentityGovernance"></div></div></div></div></div></div></div></div></div></div></div></div></div></div></div></div><div style="margin-top:16px"><strong>WHAT NEEDS ATTENTION NEXT?</strong>'+(!queue.length?'<div style="margin-top:7px;font-size:.82rem">No execution recovery items detected.</div>':queue.map((x,i)=>'<div class="card" style="padding:9px;margin-top:7px"><b>#'+(i+1)+' '+escText(x.c.name)+'</b><div style="font-size:.8rem;margin-top:3px">'+escText(x.cmp.state==="BEHIND"?"DEADLINE BEHIND":x.f.earlyWarning||x.f.status)+'</div><div style="font-size:.76rem;margin-top:3px">'+escText(creatorNavPlanRecommendations(x.f,x.target,x.cmp)[0])+'</div><button type="button" data-exec-select="'+escText(x.c.id)+'" style="margin-top:6px">OPEN PLAN</button></div>').join(""))+'</div>'+
  '<div style="margin-top:16px"><strong>PRODUCTION COLLECTIONS</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+data.map(x=>'<button type="button" data-exec-select="'+escText(x.c.id)+'">'+escText(x.c.name)+'</button>').join(""))+'</div><div id="creatorNavPredictiveDetail" style="margin-top:10px"></div></div></div>';
  const detail=document.getElementById("creatorNavPredictiveDetail");
  function renderDetail(id){
    const x=data.find(y=>y.c.id===id)||data[0];if(!x||!detail)return;
    const saved=creatorNavPlanGet(id)||{},target=x.target,cmp=x.cmp,recs=creatorNavPlanRecommendations(x.f,target,cmp),recovery=creatorNavRecoveryPlan(x,target,cmp),plan=creatorNavTodayPlan(x,target),ex=creatorNavExecutionGet(id),scenarios=creatorNavSavedScenariosRead()[id]||[];
    const actualWeekly=Math.round(x.f.velocity*7*10)/10,requiredWeekly=target?Math.round(target.requiredVelocity*7*10)/10:null;
    const projectedDeadline=x.f.velocity>0?new Date(Date.now()+Math.ceil(Math.max(0,100-x.f.pct)/x.f.velocity)*86400000).toLocaleDateString([], {dateStyle:"medium"}):"Unknown";
    const deadlineStatus=target?(cmp.state+" · "+target.days+" day(s) remaining"):"Current-pace finish: "+projectedDeadline;
    detail.innerHTML='<div class="card" style="padding:12px"><b>'+escText(x.c.name)+'</b><div style="font-size:.8rem;margin-top:4px">'+x.f.pct+'% complete · Actual '+x.f.velocity+' pts/day · <b>'+escText(cmp.state)+'</b></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:10px"><div><b>DEADLINE</b><div style="margin-top:5px">'+escText(deadlineStatus)+'</div></div><div><b>REQUIRED / ACTUAL</b><div style="margin-top:5px">'+(target?target.requiredVelocity+" / ":"— / ")+x.f.velocity+' pts/day</div></div><div><b>WEEKLY TARGET</b><div style="margin-top:5px">'+(requiredWeekly===null?actualWeekly:requiredWeekly)+' pts/week</div></div><div><b>STREAK</b><div style="margin-top:5px">'+(ex.streak||0)+' day(s)</div></div></div>'+
    '<div style="margin-top:12px"><strong>TODAY’S PRODUCTION PLAN</strong><div style="font-size:.78rem;margin-top:4px">Target: '+plan.daily+' pts today · '+plan.weekly+' pts/week · '+plan.today.length+' task(s) queued.</div>'+(!plan.today.length?'<div style="font-size:.8rem;margin-top:6px">All roadmap tasks are complete.</div>':plan.today.map(st=>'<label class="card" style="display:block;padding:8px;margin-top:6px"><input type="checkbox" data-roadmap-task="'+escText(st.key)+'" '+(ex.tasks[st.key]?"checked":"")+'> <b>'+escText(st.name)+'</b><div style="font-size:.75rem;margin-top:3px">Dependency: '+escText(st.dependency)+' · Projected: '+escText(st.projected)+'</div></label>').join(""))+'</div>'+
    '<div style="margin-top:12px"><strong>PLAN VS ACTUAL</strong><div style="font-size:.8rem;margin-top:4px">Actual: '+actualWeekly+' pts/week · Planned: '+(requiredWeekly===null?"—":requiredWeekly+" pts/week")+' · Variance: '+(target?Math.round((x.f.velocity-target.requiredVelocity)*10)/10+" pts/day":"No deadline plan")+'</div></div>'+
    '<div style="margin-top:12px"><strong>ROADMAP COMPLETION</strong>'+plan.steps.map(st=>'<div style="font-size:.78rem;margin-top:5px"><b>'+(st.done?"✓ ":"○ ")+escText(st.name)+'</b> · '+escText(st.done?"Completed":st.projected)+'</div>').join("")+'</div>'+
    '<div style="margin-top:12px"><strong>DEADLINE RECALCULATION</strong><div style="font-size:.8rem;margin-top:4px">At current actual pace, projected completion: <b>'+escText(projectedDeadline)+'</b>.</div></div>'+
    '<div style="margin-top:12px"><strong>RECOVERY PLAN</strong>'+(recovery?'<div class="card" style="padding:8px;margin-top:6px;font-size:.8rem">'+escText(recovery.message)+' Recovery window: '+fmtEta(recovery.days)+'</div>':'<div style="font-size:.8rem;margin-top:5px">No recovery plan required.</div>')+'</div>'+
    '<div style="margin-top:12px"><strong>COMPLETION HISTORY</strong>'+((ex.history||[]).slice(-8).reverse().map(h=>'<div style="font-size:.75rem;margin-top:4px">'+escText(h.done?"Completed":"Reopened")+' · '+escText(h.name)+' · '+escText(new Date(h.at).toLocaleString())+'</div>').join("")||'<div style="font-size:.8rem;margin-top:5px">No task activity yet.</div>')+'</div>'+
    '<div style="margin-top:12px"><strong>SAVED SCENARIOS</strong>'+(scenarios.length?scenarios.map(sc=>'<div style="font-size:.8rem;margin-top:5px">'+escText(sc.name)+' · '+sc.rate+' pts/day · <button type="button" data-apply-scenario="'+escText(sc.id)+'">APPLY</button> <button type="button" data-delete-scenario="'+escText(sc.id)+'">DELETE</button></div>').join(""):'<div style="font-size:.8rem;margin-top:5px">No saved scenarios.</div>')+'</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><input id="roadmapTargetDate" type="date" value="'+escText(saved.targetDate||"")+'"><input id="roadmapScenarioName" placeholder="Scenario name" style="flex:1;min-width:140px"><input id="roadmapScenarioRate" type="number" min="0" step=".1" value="'+(Number(saved.rate??x.f.velocity)||0)+'"><button type="button" id="saveRoadmap">SAVE ROADMAP</button><button type="button" id="saveScenario">SAVE SCENARIO</button></div><span id="roadmapSaved" style="font-size:.78rem;opacity:.7"></span></div>';
    detail.querySelectorAll("[data-roadmap-task]").forEach(cb=>cb.addEventListener("change",()=>{const st=plan.steps.find(z=>z.key===cb.dataset.roadmapTask);creatorNavExecutionToggle(id,cb.dataset.roadmapTask,cb.checked,st?.name||"Roadmap task");creatorNavForecastDashboardRender();}));
    document.getElementById("roadmapTargetDate")?.addEventListener("change",e=>{creatorNavPlanSave(id,{targetDate:e.target.value,pct:x.f.pct,rate:Number(document.getElementById("roadmapScenarioRate")?.value)||x.f.velocity});creatorNavForecastDashboardRender();});
    document.getElementById("saveRoadmap")?.addEventListener("click",()=>{creatorNavPlanSave(id,{targetDate:document.getElementById("roadmapTargetDate")?.value||"",pct:x.f.pct,rate:Number(document.getElementById("roadmapScenarioRate")?.value)||x.f.velocity});document.getElementById("roadmapSaved").textContent="Roadmap saved.";creatorNavForecastDashboardRender();});
    document.getElementById("saveScenario")?.addEventListener("click",()=>{creatorNavScenarioSave(id,document.getElementById("roadmapScenarioName")?.value||"Custom scenario",Number(document.getElementById("roadmapScenarioRate")?.value)||0);document.getElementById("roadmapSaved").textContent="Scenario saved.";renderDetail(id);});
    detail.querySelectorAll("[data-apply-scenario]").forEach(b=>b.addEventListener("click",()=>{const sc=scenarios.find(z=>z.id===b.dataset.applyScenario);if(sc){creatorNavPlanSave(id,{rate:sc.rate});renderDetail(id);}}));
    detail.querySelectorAll("[data-delete-scenario]").forEach(b=>b.addEventListener("click",()=>{creatorNavScenarioDelete(id,b.dataset.deleteScenario);renderDetail(id);}));
  }
  function renderCalendar(dayCount){
  const cal=creatorNavProductionCalendar(data,dayCount),grid=document.getElementById("creatorNavProductionCalendarGrid");if(!grid)return;
  const byDay={};cal.rows.forEach(r=>{const k=r.date.toISOString().slice(0,10);(byDay[k]||(byDay[k]=[])).push(r);});
  let html="";
  for(let i=0;i<dayCount;i++){const d=new Date(cal.today);d.setDate(d.getDate()+i);const k=d.toISOString().slice(0,10),items=byDay[k]||[],load={};items.forEach(r=>{const id=r.owner?.id||"unassigned";load[id]=(load[id]||0)+1;});
    const cap=cal.team.reduce((n,m)=>n+(Number(m.capacity)||0),0),used=items.length,over=used>cap&&cap>0;
    html+='<div class="card" style="padding:8px;margin-top:6px;border-left:3px solid currentColor"><b>'+escText(d.toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"}))+'</b><span style="font-size:.72rem;opacity:.7"> · '+used+' task(s) / '+cap+' team capacity'+(over?' · OVER CAPACITY':'')+'</span>';
    html+=items.length?items.map(r=>'<div style="font-size:.77rem;margin-top:5px"><b>'+escText(r.name)+'</b> · '+escText(r.collection)+' · '+escText(r.owner?.name||"Unassigned")+(r.done?' · ✓ COMPLETE':r.blocked?' · ⛔ BLOCKED':' · READY')+(r.target?' · Deadline '+escText(r.target):'')+'</div>').join(""):'<div style="font-size:.75rem;opacity:.6;margin-top:4px">No projected tasks.</div>';
    html+='</div>';
  }
  grid.innerHTML=html;
}
function renderScheduler(){
  const box=document.getElementById("creatorNavScheduler");if(!box)return;
  const plan=creatorNavScheduleSuggestions(data);
  box.innerHTML='<div style="margin-top:8px"><b>RECOMMENDED REBALANCING</b>'+(
    plan.suggestions.length?plan.suggestions.slice(0,20).map((r,i)=>'<div class="card" style="padding:7px;margin-top:5px;display:flex;gap:6px;align-items:center;justify-content:space-between"><span><b>'+escText(r.name)+'</b> · '+escText(r.collection)+'<br><small>'+escText(r.from)+' → '+escText(r.to)+(r.blocked?' · BLOCKED':'')+(r.deadline?' · Deadline '+escText(r.deadline):'')+'</small></span><button type="button" data-schedule-apply="'+i+'">REASSIGN</button></div>').join(""):'<div style="font-size:.75rem;opacity:.7;margin-top:5px">No rebalancing recommendations.</div>')+'</div>';
  box.querySelectorAll("[data-schedule-apply]").forEach(b=>b.addEventListener("click",()=>{const r=plan.suggestions[Number(b.dataset.scheduleApply)];creatorNavApplySchedule(r.collectionId,r.key,r.memberId);renderScheduler();function renderProductionBoard(){
  const box=document.getElementById("creatorNavProductionBoard");if(!box)return;
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),cols=team.map(m=>({member:m,tasks:[]}));
  data.forEach(x=>{const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,x.target);steps.forEach((st,i)=>{if(st.done)return;const mid=ex.assignments?.[st.key],c=cols.find(z=>z.member.id===mid);if(c)c.tasks.push({x,st,i,dep:creatorNavDependencyStatus(x,st,i),date:creatorNavScheduleDate(x,st,i),deadline:creatorNavDeadlineStatus(x,creatorNavScheduleDate(x,st,i))});});});
  box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:8px">'+cols.map(c=>'<div class="card" data-board-column="'+escText(c.member.id)+'" style="padding:8px"><b>'+escText(c.member.name)+'</b><small> · '+c.tasks.length+'/'+Number(c.member.capacity||0)+' capacity</small>'+c.tasks.map(t=>'<div draggable="'+(t.dep.state==="READY"?"true":"false")+'" data-board-task="'+escText(t.x.c.id)+'|'+escText(t.st.key)+'" style="padding:7px;margin-top:6px;border:1px solid currentColor;border-radius:6px;cursor:'+(t.dep.state==="READY"?"grab":"not-allowed")+'"><b>'+escText(t.st.name)+'</b><br><small>'+escText(t.x.c.name)+' · '+escText(t.dep.state)+(t.deadline.state!=="ON TIME"?" · ⚠ "+escText(t.deadline.state):"")+' · '+escText(t.date.toISOString().slice(0,10))+'</small></div>').join("")+'</div>').join("")+'</div><div style="font-size:.72rem;opacity:.7;margin-top:6px">Blocked tasks cannot be dragged until their dependency is complete. Deadline conflicts are highlighted.</div><div class="card" style="padding:8px;margin-top:8px"><b>ADAPTIVE SCHEDULE ENGINE</b><div id="creatorNavAdaptiveSchedule"></div></div><div class="card" style="padding:8px;margin-top:8px"><b>OPTIMIZED PRODUCTION SEQUENCE</b>'+creatorNavOptimizedSequence(data).map(o=>'<div style="margin-top:6px"><b>'+escText(o.collection)+'</b>'+ (o.steps.length?o.steps.map((r,n)=>'<div style="font-size:.74rem;margin-top:3px">'+(n+1)+'. '+escText(r.st.name)+' · '+escText(r.owner?.name||"Unassigned")+' · '+escText(r.dep.state)+' · '+escText(r.date.toISOString().slice(0,10))+(r.deadline.state!=="ON TIME"?" · ⚠ "+escText(r.deadline.state):"")+'</div>').join(""):'<div style="font-size:.72rem;opacity:.7">Complete.</div>')+'</div>').join("")+'</div>';
  box.querySelectorAll("[data-board-task][draggable=true]").forEach(el=>el.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",el.dataset.boardTask)));
  box.querySelectorAll("[data-board-column]").forEach(el=>el.addEventListener("dragover",e=>e.preventDefault()));
  box.querySelectorAll("[data-board-column]").forEach(el=>el.addEventListener("drop",e=>{e.preventDefault();const raw=e.dataTransfer.getData("text/plain").split("|"),m=team.find(z=>z.id===el.dataset.boardColumn);if(raw.length!==2||!m)return;const x=data.find(z=>z.c.id===raw[0]),steps=creatorNavRoadmapSteps(x,x.target),i=steps.findIndex(z=>z.key===raw[1]),st=steps[i],dep=creatorNavDependencyStatus(x,st,i);if(st&&!st.done&&dep.state==="READY"){creatorNavBoardMove(raw[0],raw[1],m.id);renderProductionBoard();renderAdaptiveSchedule();renderProductionControlRoom();renderProductionEventStream();renderProductionIntelligence();renderCreatorPerformanceIntelligence();renderIntelligentAssignments();renderAutonomousOptimizer();renderOptimizationSimulatorPanel();renderScenarioWorkspace();renderScenarioComparisonMatrix();renderScenarioApprovalEngine();renderChangeManagement();creatorNavSyncStart();renderCalendar(14);renderScheduler();}}));
}function renderProductionEventStream(){
  const box=document.getElementById("creatorNavLiveEventStream");if(!box)return;
  const rows=creatorNavEventsRead().slice(-30).reverse();
  box.innerHTML=rows.length?rows.map(e=>'<div style="font-size:.72rem;margin-top:4px"><b>'+escText(creatorNavEventTypeLabel(e.type))+'</b> · '+escText(e.name||e.key||e.collectionId||"Production")+' · '+escText(new Date(e.at).toLocaleString())+'</div>').join(""):'<div style="font-size:.72rem;opacity:.7">No production events recorded yet.</div>';
}
const CREATOR_NAV_SCENARIO_WORKSPACES_KEY="crowrules_creator_scenario_workspaces_v1";
function creatorNavScenarioWorkspacesRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_SCENARIO_WORKSPACES_KEY)||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}}
function creatorNavScenarioWorkspacesWrite(x){try{localStorage.setItem(CREATOR_NAV_SCENARIO_WORKSPACES_KEY,JSON.stringify(x));}catch{}}
function creatorNavScenarioWorkspaceSave(name,opts={}){
  const all=creatorNavScenarioWorkspacesRead(),id="ws"+Date.now();
  all[id]={id,name:String(name||"Scenario").trim()||"Scenario",options:{capacityBoost:Number(opts.capacityBoost)||0,rateMultiplier:Number(opts.rateMultiplier)||1,deadlineShift:Number(opts.deadlineShift)||0,reassign:opts.reassign||{}},createdAt:new Date().toISOString(),status:"DRAFT"};
  creatorNavScenarioWorkspacesWrite(all);return all[id];
}
const CREATOR_NAV_CHANGESETS_KEY="crowrules_creator_change_sets_v1";
function creatorNavChangeSetsRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_CHANGESETS_KEY)||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}}
function creatorNavChangeSetsWrite(x){try{localStorage.setItem(CREATOR_NAV_CHANGESETS_KEY,JSON.stringify(x));}catch{}}
function creatorNavPreflightChangeSet(data,set){
  const issues=[],steps=[];
  (set?.changes||[]).forEach(ch=>{
    const x=data.find(v=>v.c.id===ch.collectionId),road=x?creatorNavRoadmapSteps(x,x.target):[],idx=road.findIndex(st=>st.key===ch.key),step=idx>=0?road[idx]:null;
    if(!x)issues.push({type:"missing-collection",key:ch.key,message:"Collection not found"});
    else if(!step)issues.push({type:"missing-task",key:ch.key,message:"Task not found"});
    else if(step.done)issues.push({type:"completed-task",key:ch.key,message:"Task is already complete"});
    if(x&&idx>0&&!road[idx-1].done)issues.push({type:"dependency",key:ch.key,message:"Task dependency is incomplete"});
    if(ch.after&&!creatorNavTeamEnsure().some(m=>m.id===ch.after&&m.active!==false))issues.push({type:"inactive-owner",key:ch.key,message:"Target creator is unavailable"});
    steps.push({collectionId:ch.collectionId,key:ch.key,valid:!!step});
  });
  return {valid:issues.length===0,issues,steps,checkedAt:new Date().toISOString()};
}
function creatorNavChangeManifestHash(set){
  const raw=JSON.stringify((set?.changes||[]).map(c=>({id:c.id,collectionId:c.collectionId,key:c.key,before:c.before,after:c.after,status:c.status})));
  let h=0;for(let i=0;i<raw.length;i++)h=((h<<5)-h+raw.charCodeAt(i))|0;return "sha"+Math.abs(h).toString(16);
}
function creatorNavExecutionLog(changeSetId,event,detail){
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set)return;
  set.executionLog=Array.isArray(set.executionLog)?set.executionLog:[];set.executionLog.push({event,detail,at:new Date().toISOString()});set.executionLog=set.executionLog.slice(-200);creatorNavChangeSetsWrite(sets);
}
function creatorNavBuildChangeSet(data,id){
  const all=creatorNavScenarioWorkspacesRead(),ws=all[id];if(!ws)return null;
  const current=creatorNavGlobalOptimization(data).plan,map={};current.forEach(x=>map[x.collectionId+"::"+x.key]=x.recommended.member.id);
  const changes=Object.entries(ws.options.reassign||{}).map(([key,to])=>{const [collectionId,taskKey]=key.split("::");return {id:"chg"+Date.now()+Math.random().toString(36).slice(2,6),collectionId,key:taskKey,before:map[key]||null,after:to,status:"PENDING"};});
  const set={id:"cs"+Date.now(),scenarioId:id,createdAt:new Date().toISOString(),status:"PENDING",changes,manifestHash:null,preflight:null,executionLog:[],checkpoints:[]};set.manifestHash=creatorNavChangeManifestHash(set);const sets=creatorNavChangeSetsRead();sets[set.id]=set;creatorNavChangeSetsWrite(sets);return set;
}
function creatorNavTransactionState(set){return set?.status||"UNKNOWN";}
function creatorNavTransactionLockRead(){try{return JSON.parse(localStorage.getItem("crowrules_creator_transaction_lock_v1")||"{}");}catch{return {};}}
function creatorNavTransactionLockWrite(x){try{localStorage.setItem("crowrules_creator_transaction_lock_v1",JSON.stringify(x));}catch{}}
function creatorNavTransactionAcquire(id){
  const now=Date.now(),l=creatorNavTransactionLockRead();
  if(l.id&&l.id!==id&&now-(Number(l.at)||0)<30000)return false;
  creatorNavTransactionLockWrite({id,at:now,expiresAt:now+30000});return true;
}
function creatorNavTransactionRelease(id){const l=creatorNavTransactionLockRead();if(l.id===id)creatorNavTransactionLockWrite({});}
function creatorNavTransactionStale(set){const t=Date.parse(set?.startedAt||set?.createdAt||"");return ["PENDING","EXECUTING","PARTIAL_FAILURE"].includes(set?.status)&&Number.isFinite(t)&&(Date.now()-t>300000);}
const CREATOR_NAV_AUDIT_LEDGER_KEY="crowrules_creator_audit_ledger_v1";
function creatorNavCanonicalAuditRecord(e){return JSON.stringify({sequence:e.sequence,type:e.type,at:e.at,sessionId:e.sessionId,actor:e.actor,payload:e.payload||{},previousHash:e.previousHash||"GENESIS"});}
async function creatorNavCryptoHash(value){if(window.crypto?.subtle){const b=new TextEncoder().encode(value),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");}let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return "fallback-"+Math.abs(h).toString(16);}
async function creatorNavCreateVerificationCertificate(){
  const v=creatorNavAuditLedgerVerify(),ledger=creatorNavAuditLedgerRead(),head=ledger[ledger.length-1];
  const certificate={id:"cert-"+Date.now(),issuedAt:new Date().toISOString(),algorithm:"SHA-256/Web Crypto when available",entries:v.entries,verified:v.valid,headSignature:head?.signature||null,issues:v.issues};
  certificate.digest=await creatorNavCryptoHash(JSON.stringify(certificate));return certificate;
}
let creatorNavServerGovernanceState={context:null,transactions:[],changes:[],audit:[],assignments:[],lastFetch:0};
let creatorNavServerGovernanceBusy=false;

async function creatorNavServerCall(action,payload={}){
  if(typeof supabase==="undefined"||!supabase?.functions?.invoke)throw new Error("Supabase client unavailable");
  const {data,error}=await supabase.functions.invoke("creator-governance",{body:{action,...payload}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data||{};
}

async function creatorNavServerGovernanceRefresh(force=false){
  if(creatorNavServerGovernanceBusy)return creatorNavServerGovernanceState;
  if(!force&&Date.now()-creatorNavServerGovernanceState.lastFetch<5000)return creatorNavServerGovernanceState;
  creatorNavServerGovernanceBusy=true;
  try{
    const context=await creatorNavServerCall("context");
    let list={transactions:[],changes:[],audit:[]},assignments={assignments:[]};
    if(context?.role)list=await creatorNavServerCall("list");
    if(context?.role)assignments=await creatorNavServerCall("assignments");
    creatorNavServerGovernanceState={context,transactions:list.transactions||[],changes:list.changes||[],audit:list.audit||[],assignments:assignments.assignments||[],lastFetch:Date.now()};
    creatorNavServerHydrateLocal();
  }catch(err){
    creatorNavServerGovernanceState={...creatorNavServerGovernanceState,lastFetch:Date.now(),error:String(err?.message||err)};
  }finally{creatorNavServerGovernanceBusy=false;}
  return creatorNavServerGovernanceState;
}

function creatorNavServerHydrateLocal(){
  const rows=creatorNavServerGovernanceState.assignments||[];
  rows.forEach(a=>{
    const all=creatorNavExecutionRead(),x=all[a.collection_id]||{tasks:{},history:[],streak:0,lastDay:null,assignments:{},handoffs:[]};
    x.assignments=x.assignments||{};
    if(a.owner_key)x.assignments[a.task_key]=a.owner_key;else delete x.assignments[a.task_key];
    all[a.collection_id]=x;creatorNavExecutionWrite(all);
  });
}

async function creatorNavServerCreateTransaction(ws){
  const changes=Object.entries(ws?.options?.reassign||{}).map(([k,memberId])=>{
    const parts=k.split("::"),collectionId=parts[0],key=parts.slice(1).join("::"),ex=creatorNavExecutionGet(collectionId);
    return {collection_id:collectionId,task_key:key,task_name:key,before_owner:ex.assignments?.[key]||null,after_owner:memberId};
  }).filter(x=>x.collection_id&&x.task_key&&x.after_owner);
  if(!changes.length)throw new Error("Scenario has no assignment changes.");
  const result=await creatorNavServerCall("create",{scenario_id:ws.id,metadata:{scenario_name:ws.name,source:"Predictive Command Center 7.7"},changes});
  await creatorNavServerCall("transition",{transaction_id:result.transaction.id,status:"REVIEW"});
  return result.transaction;
}

async function creatorNavServerTransition(transactionId,status){
  return creatorNavServerCall("transition",{transaction_id:transactionId,status});
}
async function creatorNavServerExecute(transactionId){
  return creatorNavServerCall("execute",{transaction_id:transactionId});
}
async function creatorNavServerRollback(transactionId){
  const result=await creatorNavServerCall("rollback",{transaction_id:transactionId});
  const changes=creatorNavServerGovernanceState.changes.filter(x=>x.transaction_id===transactionId);
  changes.forEach(ch=>{
    const all=creatorNavExecutionRead(),x=all[ch.collection_id]||{tasks:{},history:[],streak:0,lastDay:null,assignments:{},handoffs:[]};
    x.assignments=x.assignments||{};
    if(ch.before_owner)x.assignments[ch.task_key]=ch.before_owner;else delete x.assignments[ch.task_key];
    all[ch.collection_id]=x;creatorNavExecutionWrite(all);
  });
  await creatorNavServerGovernanceRefresh(true);
  return result;
}

async function creatorNavIdentityContext(){
  let user=null;try{user=(await supabase.auth.getUser()).data?.user||null;}catch{}
  try{
    const server=await creatorNavServerGovernanceRefresh();
    const ctx=server.context||{};
    return {authenticated:!!user,userId:user?.id||ctx.userId||null,email:user?.email||ctx.email||"",role:ctx.role||null,verified:!!user&&!!ctx.verified,serverAuthorized:!!ctx.serverAuthorized,permissions:ctx.permissions||[]};
  }catch{return {authenticated:!!user,userId:user?.id||null,email:user?.email||"",role:null,verified:!!user,serverAuthorized:false,permissions:[]};}
}
function creatorNavRolePermissions(role){return {creator:["view","create"],admin:["view","create","review","approve","execute","rollback","govern"]}[role]||["view"];}
async function creatorNavAuthorize(action){
  const ctx=await creatorNavIdentityContext(),permissions=ctx.permissions?.length?ctx.permissions:creatorNavRolePermissions(ctx.role);
  return {allowed:ctx.verified&&ctx.serverAuthorized&&permissions.includes(action),action,context:ctx};
}
async function creatorNavGovernanceAction(type,payload={}){const ctx=await creatorNavIdentityContext();return creatorNavAuditLedgerAppend("governance-"+type,{...payload,identity:ctx,authorized:true,approvedAt:new Date().toISOString()});}
  return creatorNavAuditLedgerAppend("governance-"+type,{...payload,approvedAt:new Date().toISOString()});
}
function creatorNavAuditLedgerRead(){try{const x=JSON.parse(localStorage.getItem(CREATOR_NAV_AUDIT_LEDGER_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return [];}}
function creatorNavAuditLedgerWrite(x){try{localStorage.setItem(CREATOR_NAV_AUDIT_LEDGER_KEY,JSON.stringify(x.slice(-1000)));}catch{}}
function creatorNavAuditLedgerAppend(type,payload={}){
  const ledger=creatorNavAuditLedgerRead(),prev=ledger[ledger.length-1],seq=(prev?.sequence||0)+1,body={sequence:seq,type,at:new Date().toISOString(),sessionId:sessionStorage.getItem("crowrules_creator_session_v1")||"local",actor:sessionStorage.getItem("crowrules_creator_actor_v1")||"creator",payload,previousSignature:prev?.signature||"GENESIS"};
  body.previousHash=prev?.hash||"GENESIS";let raw=creatorNavCanonicalAuditRecord(body),h=0;for(let i=0;i<raw.length;i++)h=((h<<5)-h+raw.charCodeAt(i))|0;
  body.signature="sig-"+Math.abs(h).toString(16);body.hash="hash-"+Math.abs(h).toString(16);ledger.push(body);creatorNavAuditLedgerWrite(ledger);return body;
}
function creatorNavAuditLedgerVerify(){
  const ledger=creatorNavAuditLedgerRead(),issues=[];ledger.forEach((e,i)=>{if(e.sequence!==i+1)issues.push({sequence:e.sequence,type:"sequence"});if(i&&e.previousSignature!==ledger[i-1].signature)issues.push({sequence:e.sequence,type:"chain"});});return {valid:issues.length===0,entries:ledger.length,issues,checkedAt:new Date().toISOString()};
}
function creatorNavAuditExport(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),verification:creatorNavAuditLedgerVerify(),ledger:creatorNavAuditLedgerRead()},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="crowrules-production-audit-ledger.json";a.click();URL.revokeObjectURL(a.href);
}
function creatorNavTransactionForensics(set){
  const log=Array.isArray(set?.executionLog)?set.executionLog:[],changes=set?.changes||[],retries=Array.isArray(set?.retryHistory)?set.retryHistory:[];
  const failures=log.filter(e=>String(e.event).includes("failed")),first=log.length?Date.parse(log[0].at):NaN,last=log.length?Date.parse(log[log.length-1].at):NaN;
  const durations={};changes.forEach(c=>{const a=log.find(e=>e.event==="change-applied"&&e.detail?.key===c.key),r=log.find(e=>e.event==="change-retried"&&e.detail?.key===c.key);if(a&&r)durations[c.key]=Math.max(0,Date.parse(a.at)-Date.parse(r.at));});
  const checkpoints=Array.isArray(set?.checkpoints)?set.checkpoints:[],rollbackVerified=set?.status==="ROLLED_BACK"&&Number(set.rollbackCount||0)===(set.applied||[]).length;
  const health=Math.max(0,Math.min(100,100-failures.length*15-retries.length*5-(set.status==="PARTIAL_FAILURE"?25:0)+(rollbackVerified?5:0)));
  return {events:log.length,failures:failures.length,retries:retries.length,durationMs:Number.isFinite(first)&&Number.isFinite(last)?Math.max(0,last-first):0,durations,checkpoints:checkpoints.length,rollbackVerified,health};
}
function creatorNavAuditSearch(term,status){
  const q=String(term||"").toLowerCase(),rows=Object.values(creatorNavChangeSetsRead());
  return rows.filter(s=>(!status||s.status===status)&&(!q||JSON.stringify(s).toLowerCase().includes(q))).slice(-50).reverse();
}
function creatorNavTransactionRetryPlan(set){
  const failed=(set?.changes||[]).filter(c=>c.status==="FAILED"),attempts=Number(set?.retryCount||0);
  return {eligible:failed.length>0&&attempts<3,failed,attempts,maxAttempts:3,next:attempts+1};
}
function creatorNavTransactionRetry(data,changeSetId){
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set)return 0;
  const plan=creatorNavTransactionRetryPlan(set);if(!plan.eligible)return 0;if(!creatorNavTransactionAcquire(changeSetId))return 0;
  set.status="RETRYING";set.retryCount=plan.next;set.retryHistory=Array.isArray(set.retryHistory)?set.retryHistory:[];set.retryHistory.push({attempt:plan.next,at:new Date().toISOString(),failed:plan.failed.map(x=>x.key)});
  creatorNavTransactionCheckpoint(set,"retry-start",{attempt:plan.next,failed:plan.failed.length});creatorNavChangeSetsWrite(sets);
  let n=0;plan.failed.forEach(ch=>{try{creatorNavAssign(ch.collectionId,ch.key,ch.after);ch.status="APPLIED";ch.retriedAt=new Date().toISOString();n++;creatorNavExecutionLog(changeSetId,"change-retried",{key:ch.key,attempt:plan.next});}catch(err){creatorNavExecutionLog(changeSetId,"retry-failed",{key:ch.key,error:String(err)});}});
  set.status=(set.changes||[]).every(c=>c.status==="APPLIED")?"APPLIED":"PARTIAL_FAILURE";set.recovery=creatorNavTransactionRecovery(set);creatorNavTransactionCheckpoint(set,"retry-complete",{attempt:plan.next,recovered:n});creatorNavChangeSetsWrite(sets);creatorNavTransactionRelease(changeSetId);creatorNavEvent("changeset-retry",{changeSetId,attempt:plan.next,recovered:n});return n;
}
function creatorNavTransactionRecovery(set){
  if(!set)return {action:"NONE",reason:"No transaction"};
  if(set.status==="PARTIAL_FAILURE")return {action:"ROLLBACK",reason:"Partial failure detected"};
  if(set.status==="BLOCKED")return {action:"REVALIDATE",reason:"Preflight validation failed"};
  if(creatorNavTransactionStale(set))return {action:"RECOVER",reason:"Transaction appears stale"};
  if(set.status==="EXECUTING")return {action:"RESUME_OR_ROLLBACK",reason:"Execution state requires review"};
  return {action:"NONE",reason:"Transaction state is stable"};
}
function creatorNavTransactionCheckpoint(set,type,payload={}){
  set.checkpoints=Array.isArray(set.checkpoints)?set.checkpoints:[];set.checkpoints.push({type,at:new Date().toISOString(),...payload});set.checkpoints=set.checkpoints.slice(-20);return set;
}
function creatorNavApplyChangeSet(data,changeSetId){
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set||!["PENDING","EXECUTING"].includes(set.status))return 0;if(creatorNavTransactionStale(set)&&set.status!=="EXECUTING"){set.status="STALE";creatorNavChangeSetsWrite(sets);return 0;}if(!creatorNavTransactionAcquire(changeSetId))return 0;set.status="EXECUTING";set.startedAt=set.startedAt||new Date().toISOString();creatorNavTransactionCheckpoint(set,"execution-start",{manifestHash:set.manifestHash});creatorNavChangeSetsWrite(sets);
  const pre=creatorNavPreflightChangeSet(data,set);set.preflight=pre;creatorNavExecutionLog(changeSetId,"preflight",pre);
  if(!pre.valid){set.status="BLOCKED";creatorNavTransactionCheckpoint(set,"preflight-failed",{issues:pre.issues.length});creatorNavChangeSetsWrite(sets);creatorNavTransactionRelease(changeSetId);creatorNavEvent("changeset-preflight-failed",{changeSetId,count:pre.issues.length});return 0;}
  const applied=[];set.checkpoints=set.checkpoints||[];set.checkpoints.push({type:"before",at:new Date().toISOString(),manifestHash:set.manifestHash});
  (set.changes||[]).forEach(ch=>{const before=creatorNavExecutionGet(ch.collectionId).assignments?.[ch.key]||null;try{if(before!==ch.after){creatorNavAssign(ch.collectionId,ch.key,ch.after);ch.status="APPLIED";ch.appliedAt=new Date().toISOString();applied.push({...ch,before});creatorNavExecutionLog(changeSetId,"change-applied",{key:ch.key,collectionId:ch.collectionId});}}catch(err){ch.status="FAILED";creatorNavExecutionLog(changeSetId,"change-failed",{key:ch.key,error:String(err)});}});
  set.status=applied.length===(set.changes||[]).length?"APPLIED":"PARTIAL_FAILURE";set.recovery=creatorNavTransactionRecovery(set);creatorNavTransactionCheckpoint(set,set.status==="APPLIED"?"execution-complete":"partial-failure",{count:applied.length,recovery:set.recovery});set.appliedAt=new Date().toISOString();set.applied=applied;set.checkpoints.push({type:"after",at:new Date().toISOString(),count:applied.length});creatorNavChangeSetsWrite(sets);creatorNavTransactionRelease(changeSetId);creatorNavAuditLedgerAppend("changeset-applied",{changeSetId,scenarioId:set.scenarioId,count:applied.length,status:set.status,before:set.checkpoints?.[0]||null,after:set.checkpoints?.[set.checkpoints.length-1]||null});creatorNavEvent("changeset-applied",{changeSetId,scenarioId:set.scenarioId,count:applied.length,status:set.status});return applied.length;
}
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set||set.status!=="PENDING")return 0;
  const applied=[];
  (set.changes||[]).forEach(ch=>{const before=creatorNavExecutionGet(ch.collectionId).assignments?.[ch.key]||null;if(before!==ch.after){creatorNavAssign(ch.collectionId,ch.key,ch.after);ch.status="APPLIED";ch.appliedAt=new Date().toISOString();applied.push({...ch,before});}});
  set.status="APPLIED";set.appliedAt=new Date().toISOString();set.applied=applied;creatorNavChangeSetsWrite(sets);creatorNavEvent("changeset-applied",{changeSetId,scenarioId:set.scenarioId,count:applied.length});return applied.length;
}
function creatorNavRollbackChangeSet(changeSetId){
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set||!["APPLIED","PARTIAL_FAILURE","STALE"].includes(set.status))return 0;if(!creatorNavTransactionAcquire(changeSetId))return 0;set.status="ROLLING_BACK";creatorNavTransactionCheckpoint(set,"rollback-start");let n=0;
  (set.applied||[]).slice().reverse().forEach(ch=>{try{if(ch.before){creatorNavAssign(ch.collectionId,ch.key,ch.before);n++;creatorNavExecutionLog(changeSetId,"rollback-change",{key:ch.key,collectionId:ch.collectionId});}}catch(err){creatorNavExecutionLog(changeSetId,"rollback-failed",{key:ch.key,error:String(err)});}});
  set.status="ROLLED_BACK";set.rolledBackAt=new Date().toISOString();set.rollbackCount=n;set.checkpoints=set.checkpoints||[];set.checkpoints.push({type:"rollback",at:new Date().toISOString(),count:n});set.recovery=creatorNavTransactionRecovery(set);creatorNavTransactionCheckpoint(set,"rollback-complete",{count:n});creatorNavChangeSetsWrite(sets);creatorNavTransactionRelease(changeSetId);creatorNavAuditLedgerAppend("changeset-rollback",{changeSetId,scenarioId:set.scenarioId,count:n,changes:set.applied||[]});creatorNavEvent("changeset-rollback",{changeSetId,scenarioId:set.scenarioId,count:n});return n;
}
  const sets=creatorNavChangeSetsRead(),set=sets[changeSetId];if(!set||set.status!=="APPLIED")return 0;let n=0;
  (set.applied||[]).slice().reverse().forEach(ch=>{if(ch.before){creatorNavAssign(ch.collectionId,ch.key,ch.before);n++;}});
  set.status="ROLLED_BACK";set.rolledBackAt=new Date().toISOString();set.rollbackCount=n;creatorNavChangeSetsWrite(sets);creatorNavEvent("changeset-rollback",{changeSetId,scenarioId:set.scenarioId,count:n});return n;
}
async function creatorNavScenarioTransition(id,status,note){
  const all=creatorNavScenarioWorkspacesRead(),ws=all[id];if(!ws)return null;
  const allowed={DRAFT:["REVIEW"],REVIEW:["APPROVED","DRAFT"],APPROVED:["APPLIED","REVIEW"],APPLIED:["ARCHIVED"],ARCHIVED:[]};
  if(!(allowed[ws.status]||[]).includes(status))return ws;
  try{
    if(status==="REVIEW"&&!ws.serverTransactionId){await creatorNavScenarioWorkspaceApply(data,id);return creatorNavScenarioWorkspacesRead()[id]||ws;}
    if(!ws.serverTransactionId)throw new Error("SERVER_TRANSACTION_REQUIRED");
    if(status==="APPLIED"){
      await creatorNavServerExecute(ws.serverTransactionId);
      const serverChanges=creatorNavServerGovernanceState.changes.filter(x=>x.transaction_id===ws.serverTransactionId);
      serverChanges.forEach(ch=>{const ex=creatorNavExecutionGet(ch.collection_id);ex.assignments=ex.assignments||{};if(ch.after_owner)ex.assignments[ch.task_key]=ch.after_owner;else delete ex.assignments[ch.task_key];const allExec=creatorNavExecutionRead();allExec[ch.collection_id]=ex;creatorNavExecutionWrite(allExec);});
    }else{
      await creatorNavServerTransition(ws.serverTransactionId,status);
    }
    const from=ws.status;ws.status=status;ws.audit=Array.isArray(ws.audit)?ws.audit:[];ws.audit.push({from,to:status,note:String(note||""),at:new Date().toISOString(),serverTransactionId:ws.serverTransactionId});
    if(status==="APPLIED")ws.appliedAt=new Date().toISOString();
    ws.updatedAt=new Date().toISOString();all[id]=ws;creatorNavScenarioWorkspacesWrite(all);creatorNavEvent("scenario-status",{scenarioId:id,status,note:String(note||""),serverTransactionId:ws.serverTransactionId});
    await creatorNavServerGovernanceRefresh(true);renderScenarioApprovalEngine?.();renderProductionTransactionConsole?.();return ws;
  }catch(err){alert("Server governance rejected this transition: "+String(err?.message||err));return ws;}
}
function creatorNavScenarioChangeSummary(data,ws){
  const sim=creatorNavSimulation(data,ws.options),current=creatorNavGlobalOptimization(data),currentMap={};
  current.plan.forEach(x=>currentMap[x.collectionId+"::"+x.key]=x.recommended.member.name);
  const changes=Object.entries(ws.options.reassign||{}).map(([k,v])=>({key:k,before:currentMap[k]||"Unassigned",after:creatorNavTeamEnsure().find(m=>m.id===v)?.name||"Unknown"}));
  return {changes,throughput:sim.throughput,utilization:sim.utilization,blocked:sim.blocked,capacity:sim.capacity};
}
async function creatorNavScenarioWorkspaceApply(data,id){
  const all=creatorNavScenarioWorkspacesRead(),ws=all[id];if(!ws)return 0;
  try{
    const tx=await creatorNavServerCreateTransaction(ws);
    ws.serverTransactionId=tx.id;ws.status="REVIEW";ws.serverSubmittedAt=new Date().toISOString();all[id]=ws;creatorNavScenarioWorkspacesWrite(all);
    creatorNavEvent("scenario-submitted",{scenarioId:id,name:ws.name,transactionId:tx.id});
    await creatorNavServerGovernanceRefresh(true);renderScenarioWorkspace?.();renderScenarioApprovalEngine?.();renderProductionTransactionConsole?.();return ws;
  }catch(err){alert("Server governance rejected this scenario: "+String(err?.message||err));return 0;}
}
function creatorNavScenarioWorkspaceDelete(id){const all=creatorNavScenarioWorkspacesRead();delete all[id];creatorNavScenarioWorkspacesWrite(all);}
function creatorNavScenarioMatrix(data){
  const all=creatorNavScenarioWorkspacesRead(),rows=Object.values(all).slice(-8).reverse();
  return rows.map(ws=>{const sim=creatorNavSimulation(data,ws.options),current=creatorNavGlobalOptimization(data),baseThroughput=current.plan.length;return {...ws,simulation:sim,completionDays:sim.throughput>0?Math.ceil(Math.max(0,100-(data.reduce((n,x)=>n+(Number(x.f?.pct)||0),0)/Math.max(1,data.length)))/sim.throughput):null,workload:sim.utilization,dependencyRisk:sim.blocked,recoveryImpact:sim.utilization>100?"HIGH":sim.blocked?"MEDIUM":"LOW",productionImpact:Math.round((sim.throughput-baseThroughput)*10)/10};});
}
function creatorNavScenarioSelect(id){const all=creatorNavScenarioWorkspacesRead(),ws=all[id];if(ws){ws.selectedAt=new Date().toISOString();all[id]=ws;creatorNavScenarioWorkspacesWrite(all);creatorNavEvent("scenario-selected",{scenarioId:id,name:ws.name});}return ws||null;}
function creatorNavScenarioWorkspaceCompare(data,ids){
  const all=creatorNavScenarioWorkspacesRead();
  return ids.map(id=>{const ws=all[id];if(!ws)return null;const sim=creatorNavSimulation(data,ws.options),days=sim.throughput>0?Math.ceil(Math.max(0,100-(data.reduce((n,x)=>n+(Number(x.f?.pct)||0),0)/Math.max(1,data.length)))/sim.throughput):null;return {...ws,simulation:sim,projectedDays:days,risk:sim.blocked>0?"DEPENDENCY RISK":sim.utilization>100?"CAPACITY RISK":"LOWER RISK"};}).filter(Boolean);
}
function creatorNavSimulation(data,opts={}){
  const capacityBoost=Math.max(0,Number(opts.capacityBoost)||0),rateMultiplier=Math.max(.1,Number(opts.rateMultiplier)||1),deadlineShift=Math.trunc(Number(opts.deadlineShift)||0),reassign=opts.reassign||{};
  const base=creatorNavGlobalOptimization(data),team=creatorNavTeamEnsure().map(m=>({...m,capacity:Number(m.capacity)||0}));
  team.forEach(m=>m.capacity+=capacityBoost);
  const simulated=base.plan.map(t=>{
    const mid=reassign[t.collectionId+"::"+t.key]||t.recommended.member.id;
    const member=team.find(m=>m.id===mid)||t.recommended.member;
    return {...t,recommended:{...t.recommended,member,capacity:member.capacity}};
  });
  const ready=simulated.length,blocked=base.blocked.length;
  const capacity=team.reduce((n,m)=>n+m.capacity,0),util=capacity?Math.round(ready/capacity*100):0;
  const deadlines=data.map(x=>{const target=x.target?.targetDate;if(!target)return null;const d=new Date(target+"T23:59:59");d.setDate(d.getDate()+deadlineShift);return {id:x.c.id,date:d.toISOString().slice(0,10)};}).filter(Boolean);
  const throughput=data.reduce((n,x)=>n+(Number(x.f?.velocity)||0),0)*rateMultiplier;
  return {ready,blocked,capacity,utilization:util,throughput,deadlines,assignments:simulated,capacityBoost,rateMultiplier,deadlineShift,reassign};
}
function creatorNavSimulationCompare(data,opts={}){
  const base=creatorNavSimulation(data),test=creatorNavSimulation(data,opts);
  return {base,test,delta:{throughput:Math.round((test.throughput-base.throughput)*10)/10,capacity:test.capacity-base.capacity,utilization:test.utilization-base.utilization,ready:test.ready-base.ready,blocked:test.blocked-base.blocked}};
}
function creatorNavGlobalOptimization(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),load=Object.fromEntries(team.map(m=>[m.id,0])),plan=[],blocked=[];
  const tasks=creatorNavAssignmentRecommendations(data).sort((a,b)=>{
    const ad=a.collectionId,bd=b.collectionId;
    const ax=data.find(x=>x.c.id===ad),bx=data.find(x=>x.c.id===bd);
    const au=ax?.target?.targetDate?new Date(ax.target.targetDate).getTime():Infinity,bu=bx?.target?.targetDate?new Date(bx.target.targetDate).getTime():Infinity;
    return (a.dependency.state==="READY"?0:1)-(b.dependency.state==="READY"?0:1)||au-bu;
  });
  tasks.forEach(t=>{
    if(t.dependency.state!=="READY"){blocked.push(t);return;}
    const ranked=team.map(m=>{
      const perf=creatorNavCreatorPerformance(data,m.id)||{},capacity=Math.max(1,Number(m.capacity)||1),util=(load[m.id]||0)/capacity;
      const urgency=t.best?.score||0,score=Math.round((urgency-util*40+(perf.completionRate||0)*.2+(perf.deadlineReliability||50)*.1)*10)/10;
      return {member:m,score,load:load[m.id]||0,capacity,utilization:Math.round(util*100)};
    }).sort((a,b)=>b.score-a.score);
    const pick=ranked[0];if(pick){load[pick.member.id]++;plan.push({...t,recommended:pick,alternatives:ranked.slice(1,3)});}
  });
  return {plan,blocked,load,team,generatedAt:new Date().toISOString()};
}
function creatorNavOptimizerApply(result){
  let changed=0;result.plan.forEach(t=>{const current=creatorNavExecutionGet(t.collectionId).assignments?.[t.key];if(current!==t.recommended.member.id){creatorNavAssign(t.collectionId,t.key,t.recommended.member.id);creatorNavEvent("optimizer-assignment",{collectionId:t.collectionId,key:t.key,memberId:t.recommended.member.id});changed++;}});
  return changed;
}
function creatorNavAssignmentScore(data,x,step,member){
  const ex=creatorNavExecutionGet(x.c.id),work=creatorNavTeamWorkload(data).find(r=>r.member.id===member.id),load=work?.load||0,capacity=Math.max(1,Number(member.capacity)||1);
  const dep=creatorNavDependencyStatus(x,step,creatorNavRoadmapSteps(x,x.target).findIndex(z=>z.key===step.key));
  const deadline=x.target?.targetDate?Math.ceil((new Date(x.target.targetDate+"T23:59:59")-new Date())/86400000):null;
  const performance=creatorNavCreatorPerformance(data,member.id)||{},util=Math.min(150,load/capacity*100);
  const urgency=deadline!==null?Math.max(0,10-Math.max(0,deadline))/10:0;
  const score=Math.round((100-util*.45+(performance.completionRate||0)*.25+(performance.deadlineReliability||50)*.15+(performance.streak||0)*1.5+urgency*15+(dep.state==="READY"?10:0))*10)/10;
  return {score,load,capacity,utilization:Math.round(util),completionRate:performance.completionRate||0,deadlineReliability:performance.deadlineReliability,dependency:dep.state};
}
function creatorNavAssignmentRecommendations(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),out=[];
  data.forEach(x=>{
    const steps=creatorNavRoadmapSteps(x,x.target),ex=creatorNavExecutionGet(x.c.id);
    steps.forEach((step,i)=>{
      if(step.done)return;
      const ranked=team.map(m=>({member:m,...creatorNavAssignmentScore(data,x,step,m)})).sort((a,b)=>b.score-a.score);
      const current=ranked.find(r=>r.member.id===ex.assignments?.[step.key])||null;
      out.push({collectionId:x.c.id,collection:x.c.name,key:step.key,name:step.name,dependency:creatorNavDependencyStatus(x,step,i),current,best:ranked[0]||null,alternatives:ranked.slice(1,3)});
    });
  });
  return out;
}
function creatorNavApplyRecommendedAssignment(id,key,memberId){creatorNavAssign(id,key,memberId);creatorNavEvent("smart-assignment",{collectionId:id,key,memberId});}
function creatorNavCreatorPerformance(data,memberId){
  const team=creatorNavTeamEnsure(),member=team.find(m=>m.id===memberId);if(!member)return null;
  const assigned=[],completed=[],events=creatorNavEventsRead();
  data.forEach(x=>{
    const ex=creatorNavExecutionGet(x.c.id),steps=creatorNavRoadmapSteps(x,x.target);
    steps.forEach(st=>{if(ex.assignments?.[st.key]===memberId)assigned.push({...st,collectionId:x.c.id,collection:x.c.name,target:x.target?.targetDate||null});});
    (ex.history||[]).forEach(h=>{if(h.type==="assignment"&&h.memberId===memberId){}});
  });
  assigned.forEach(st=>{if(st.done)completed.push(st);});
  const memberEvents=events.filter(e=>e.memberId===memberId||e.to===memberId||e.from===memberId);
  const completionRate=assigned.length?Math.round(completed.length/assigned.length*100):0;
  const capacity=Math.max(0,Number(member.capacity)||0),utilization=capacity?Math.round(assigned.filter(x=>!x.done).length/capacity*100):0;
  const contribution=memberEvents.length;
  const streak=data.reduce((n,x)=>Math.max(n,creatorNavExecutionGet(x.c.id).streak||0),0);
  const deadlines=assigned.filter(x=>x.done&&x.target),deadlineReliability=deadlines.length?Math.round(deadlines.filter(x=>new Date()<=new Date(x.target+"T23:59:59")).length/deadlines.length*100):null;
  return {member,assigned,completed,completionRate,utilization,contribution,streak,deadlineReliability,capacity,open:assigned.filter(x=>!x.done).length,bottlenecks:assigned.filter((x,i)=>i>0&&!assigned[i-1].done).length,events:memberEvents.slice(-50)};
}
function creatorNavCreatorPerformanceAll(data){
  return creatorNavTeamEnsure().filter(m=>m.active!==false).map(m=>creatorNavCreatorPerformance(data,m.id)).filter(Boolean);
}
function creatorNavPerformanceRecommendations(data){
  return creatorNavCreatorPerformanceAll(data).map(p=>{
    const rec=[];
    if(p.utilization>100)rec.push("Reduce workload or reassign tasks");
    if(p.completionRate<50&&p.open>0)rec.push("Prioritize open tasks");
    if(p.bottlenecks)rec.push("Resolve dependency bottlenecks");
    if(p.utilization<50&&p.open<2)rec.push("Consider assigning ready work");
    return {...p,recommendations:rec};
  });
}
function creatorNavProductionIntelligence(data){
  const team=creatorNavTeamEnsure().filter(m=>m.active!==false),workload=creatorNavTeamWorkload(data),adaptive=creatorNavAdaptiveSchedule(data);
  const all=adaptive.collections.flatMap(c=>c.rows),open=all.length,done=data.reduce((n,x)=>n+creatorNavRoadmapSteps(x,x.target).filter(s=>s.done).length,0),total=data.reduce((n,x)=>n+creatorNavRoadmapSteps(x,x.target).length,0);
  const completion=total?Math.round(done/total*100):100,conflicts=adaptive.conflicts.length,overdue=adaptive.conflicts.filter(x=>x.status==="OVERDUE").length;
  const velocity=data.reduce((n,x)=>n+(Number(x.f?.velocity)||0),0),capacity=team.reduce((n,m)=>n+(Number(m.capacity)||0),0),load=workload.reduce((n,r)=>n+r.load,0);
  const dependencyBottlenecks=all.filter(r=>r.dependency?.state==="BLOCKED").length;
  const events=creatorNavEventsRead();
  return {team,workload,open,done,total,completion,conflicts,overdue,velocity,capacity,load,utilization:capacity?Math.round(load/capacity*100):0,dependencyBottlenecks,events,recovery:adaptive.recovery.length};
}
function renderIdentityGovernance(){
  const box=document.getElementById("creatorNavIdentityGovernance");if(!box)return;
  creatorNavIdentityContext().then(async ctx=>{
    const p=ctx.permissions?.length?ctx.permissions:creatorNavRolePermissions(ctx.role),s=creatorNavServerGovernanceState;
    box.innerHTML='<div class="card" style="padding:10px"><b>IDENTITY, ROLES & SERVER GOVERNANCE · 7.7</b><div style="margin-top:5px">Identity: '+escText(ctx.userId||"Not authenticated")+' · Role: '+escText(ctx.role||"none")+' · Verified: '+(ctx.verified?"YES":"NO")+' · Server Authorized: '+(ctx.serverAuthorized?"YES":"NO")+'</div><div style="margin-top:5px">Permissions: '+p.join(", ")+'</div><div style="margin-top:5px">Server transactions: '+(s.transactions?.length||0)+' · Audit records: '+(s.audit?.length||0)+' · Protected assignments: '+(s.assignments?.length||0)+'</div>'+(s.error?'<div style="margin-top:5px;color:#ff9a9a">Governance service: '+escText(s.error)+'</div>':'')+'</div>';
  });
}
function renderCryptographicGovernance(){
  const box=document.getElementById("creatorNavCryptoGovernance");if(!box)return;
  const l=creatorNavAuditLedgerRead(),v=creatorNavAuditLedgerVerify(),head=l[l.length-1];
  box.innerHTML='<div class="card" style="padding:10px"><b>CRYPTOGRAPHIC AUDIT & GOVERNANCE ENGINE</b><div style="margin-top:5px">SHA-256: Web Crypto when available · Chain: <b>'+ (v.valid?"VERIFIED":"FAILED")+'</b> · Head: '+escText(head?.hash||"GENESIS")+'</div><div style="margin-top:6px"><button id="cryptoCert">CREATE VERIFICATION CERTIFICATE</button><button id="cryptoExport">SIGNED AUDIT EXPORT</button></div><div id="cryptoCertOut" style="margin-top:6px"></div></div>';
  document.getElementById("cryptoCert").onclick=async()=>{const c=await creatorNavCreateVerificationCertificate();document.getElementById("cryptoCertOut").innerHTML='<small>Certificate '+escText(c.id)+' · Digest '+escText(c.digest)+' · '+(c.verified?"VERIFIED":"FAILED")+'</small>';};
  document.getElementById("cryptoExport").onclick=async()=>{const c=await creatorNavCreateVerificationCertificate(),blob=new Blob([JSON.stringify({certificate:c,ledger:creatorNavAuditLedgerRead()},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="crowrules-signed-audit-export.json";a.click();URL.revokeObjectURL(a.href);creatorNavGovernanceAction("audit-export",{certificateId:c.id});};
}
function renderAuditCompliance(){
  const box=document.getElementById("creatorNavAuditCompliance");if(!box)return;const v=creatorNavAuditLedgerVerify(),l=creatorNavAuditLedgerRead();
  box.innerHTML='<div class="card" style="padding:10px"><b>IMMUTABLE AUDIT LEDGER & COMPLIANCE</b><div style="margin-top:5px">Chain verification: <b>'+ (v.valid?"VERIFIED":"FAILED")+'</b> · Entries: '+v.entries+' · Issues: '+v.issues.length+'</div><div style="margin-top:6px"><button id="auditExport">EXPORT AUDIT LEDGER</button><button id="auditVerify">VERIFY LEDGER</button></div><details style="margin-top:7px"><summary>LEDGER HISTORY</summary>'+l.slice().reverse().slice(0,50).map(e=>'<div style="font-size:.7rem;margin-top:3px"><b>#'+e.sequence+'</b> · '+escText(e.type)+' · '+escText(e.at)+' · '+escText(e.actor)+' · '+escText(e.signature)+'</div>').join("")+'</details></div>';
  document.getElementById("auditExport").onclick=creatorNavAuditExport;document.getElementById("auditVerify").onclick=()=>{const x=creatorNavAuditLedgerVerify();alert(x.valid?"Audit ledger verified.":"Ledger verification failed: "+x.issues.length+" issue(s).");renderAuditCompliance();};
}
function renderTransactionForensics(){
  const box=document.getElementById("creatorNavTransactionForensics");if(!box)return;
  const rows=Object.values(creatorNavChangeSetsRead()).slice(-20).reverse();
  box.innerHTML='<div class="card" style="padding:8px"><b>TRANSACTION FORENSICS & AUDIT INTELLIGENCE</b><div style="margin-top:6px"><input id="txAuditSearch" placeholder="Search transaction audit…" style="width:70%"><select id="txAuditStatus"><option value="">All states</option><option>PENDING</option><option>EXECUTING</option><option>APPLIED</option><option>PARTIAL_FAILURE</option><option>ROLLED_BACK</option><option>BLOCKED</option><option>STALE</option></select></div></div><div id="txAuditRows"></div>';
  const render=()=>{const data=creatorNavAuditSearch(document.getElementById("txAuditSearch")?.value,document.getElementById("txAuditStatus")?.value),r=document.getElementById("txAuditRows");if(!r)return;r.innerHTML=data.map(set=>{const x=creatorNavTransactionForensics(set);return '<div class="card" style="padding:8px;margin-top:6px"><b>'+escText(set.id)+'</b> · '+escText(set.status)+' · Health '+x.health+'/100<div><small>Events '+x.events+' · Failures '+x.failures+' · Retries '+x.retries+' · Duration '+Math.round(x.durationMs/1000)+'s · Checkpoints '+x.checkpoints+' · Rollback '+(x.rollbackVerified?"VERIFIED":"—")+'</small></div><details><summary>FORENSIC EVENT LOG</summary>'+((set.executionLog||[]).slice().reverse().map(e=>'<div style="font-size:.7rem;margin-top:3px">'+escText(e.at)+' · '+escText(e.event)+' · '+escText(JSON.stringify(e.detail||{}))+'</div>').join("")||"<small>None</small>")+'</details></div>';}).join("")||'<small>No matching transaction records.</small>';};
  document.getElementById("txAuditSearch").oninput=render;document.getElementById("txAuditStatus").onchange=render;render();
}
function renderTransactionTimeline(){
  const box=document.getElementById("creatorNavTransactionTimeline");if(!box)return;
  const rows=Object.values(creatorNavChangeSetsRead()).slice(-10).reverse();
  box.innerHTML=rows.map(set=>{const events=(set.executionLog||[]).slice().reverse().slice(0,20);const plan=creatorNavTransactionRetryPlan(set);return '<div class="card" style="padding:8px;margin-top:6px"><b>'+escText(set.id)+'</b> · '+escText(set.status)+'<div style="margin:6px 0">'+(events.map(e=>'<span style="display:inline-block;padding:3px 6px;margin:2px;border:1px solid currentColor;border-radius:8px;font-size:.68rem">'+escText(e.event)+' · '+escText(e.at)+'</span>').join("")||"<small>No events</small>")+'</div>'+(plan.eligible?'<button data-tx-retry="'+set.id+'">RETRY FAILED STEPS ('+plan.failed.length+')</button>':"")+'</div>';}).join("")||'<small>No transaction timeline yet.</small>';
  box.querySelectorAll("[data-tx-retry]").forEach(b=>b.onclick=()=>{if(confirm("Retry only the failed steps in this transaction?")){creatorNavTransactionRetry(data,b.dataset.txRetry);renderTransactionTimeline();renderProductionTransactionConsole();renderTransactionSafety();}});
}
function renderTransactionSafety(){
  const box=document.getElementById("creatorNavTransactionSafety");if(!box)return;
  const rows=Object.values(creatorNavChangeSetsRead()).slice(-12).reverse();
  box.innerHTML=rows.map(set=>{const stale=creatorNavTransactionStale(set),rec=creatorNavTransactionRecovery(set);return '<div class="card" style="padding:8px;margin-top:6px"><b>'+escText(set.id)+'</b> · '+escText(set.status)+(stale?' · STALE':'')+'<div><small>Recovery: '+escText(rec.action)+' — '+escText(rec.reason)+'</small></div><div style="margin-top:4px">Checkpoints: '+(set.checkpoints?.length||0)+' · Retries: '+(set.retryCount||0)+'</div></div>';}).join("")||'<small>No transaction safety records.</small>';
}
function renderProductionTransactionConsole(){
  const box=document.getElementById("creatorNavTransactionConsole");if(!box)return;
  const render=()=>{
    const s=creatorNavServerGovernanceState,rows=(s.transactions||[]).slice(0,20);
    box.innerHTML='<div class="card" style="padding:10px"><b>PRODUCTION TRANSACTION CONSOLE 7.7</b><div style="margin-top:5px"><small>Supabase is authoritative. Browser localStorage cannot execute, approve, or roll back production transactions.</small></div></div>'+rows.map(t=>{
      const changes=s.changes.filter(c=>c.transaction_id===t.id),next=t.status==="PENDING"?"REVIEW":t.status==="REVIEW"?"APPROVED":t.status==="APPROVED"?"EXECUTE":(["APPLIED","PARTIAL_FAILURE"].includes(t.status)?"ROLLBACK":"");
      const action=next==="EXECUTE"?"EXECUTE":next;
      return '<div class="card" style="padding:10px;margin-top:8px"><div><b>'+escText(t.id)+'</b> · <b>'+escText(t.status)+'</b></div><small>Scenario: '+escText(t.scenario_id||"—")+' · Manifest: '+escText(t.manifest_hash||"—")+' · Actor: '+escText(t.actor_user_id||"—")+'</small><div style="margin-top:6px">Changes: '+changes.length+' · Preflight: '+((t.preflight||{}).valid?"PASS":"SERVER CHECKED")+'</div><details style="margin-top:6px"><summary>CHANGE MANIFEST</summary>'+changes.map(c=>'<div style="font-size:.72rem;margin-top:3px">'+escText(c.collection_id)+' / '+escText(c.task_key)+' · '+escText(c.before_owner||"Unassigned")+' → '+escText(c.after_owner||"Unassigned")+' · <b>'+escText(c.status)+'</b></div>').join("")+'</details><div style="margin-top:7px">'+(action?'<button data-server-tx="'+escText(t.id)+'" data-server-action="'+action+'">'+(action==="REVIEW"?"SUBMIT REVIEW":action==="APPROVED"?"APPROVE":action)+'</button>':"")+'</div></div>';
    }).join("")||'<small>No server-side production transactions yet.</small>';
    box.querySelectorAll("[data-server-tx]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.serverTx,action=b.dataset.serverAction;
      try{
        if(action==="REVIEW")await creatorNavServerTransition(id,"REVIEW");
        else if(action==="APPROVED")await creatorNavServerTransition(id,"APPROVED");
        else if(action==="EXECUTE")await creatorNavServerExecute(id);
        else if(action==="ROLLBACK")await creatorNavServerRollback(id);
        await creatorNavServerGovernanceRefresh(true);render();
      }catch(err){alert("Server governance rejected this action: "+String(err?.message||err));}
    });
  };
  creatorNavServerGovernanceRefresh().then(render);
}
function renderChangeManagement(){
  const box=document.getElementById("creatorNavChangeManagement");if(!box)return;
  const sets=Object.values(creatorNavChangeSetsRead()).slice(-10).reverse();
  box.innerHTML=sets.map(cs=>'<div class="card" style="padding:7px;margin-top:5px"><b>'+escText(cs.id)+'</b><small> · '+escText(cs.status)+'</small><div>'+(cs.changes?.length||0)+' controlled change(s)</div><div style="margin-top:4px">'+(cs.status==="PENDING"?'<button data-cs-apply="'+cs.id+'">CONFIRM & APPLY</button>':cs.status==="APPLIED"?'<button data-cs-rollback="'+cs.id+'">ROLLBACK SCENARIO</button>':"")+'</div></div>').join("")||'<small>Approved scenarios can generate controlled change sets here.</small>';
  box.querySelectorAll("[data-cs-apply]").forEach(b=>b.onclick=()=>{if(confirm("Confirm and apply this production change set?")){creatorNavApplyChangeSet(data,b.dataset.csApply);renderChangeManagement();}});
  box.querySelectorAll("[data-cs-rollback]").forEach(b=>b.onclick=()=>{if(confirm("Rollback this applied scenario?")){creatorNavRollbackChangeSet(b.dataset.csRollback);renderChangeManagement();}});
}
function renderScenarioApprovalEngine(){
  const box=document.getElementById("creatorNavScenarioApproval");if(!box)return;
  const all=creatorNavScenarioWorkspacesRead(),rows=Object.values(all).slice(-12).reverse();
  box.innerHTML='<div class="card" style="padding:8px"><b>SERVER-SIDE APPROVAL GATE</b><div style="font-size:.75rem;margin-top:4px">Approval, execution, and rollback are enforced by Supabase; browser state is cache only.</div></div>'+rows.map(ws=>{
    const sum=creatorNavScenarioChangeSummary(data,ws),next={DRAFT:"REVIEW",REVIEW:"APPROVED",APPROVED:"APPLIED",APPLIED:"ARCHIVED"}[ws.status];
    return '<div class="card" style="padding:8px;margin-top:6px"><b>'+escText(ws.name)+'</b><small> · '+escText(ws.status)+'</small><div style="margin-top:4px">Impact: throughput '+sum.throughput.toFixed(1)+' · utilization '+sum.utilization+'% · blocked '+sum.blocked+' · '+sum.changes.length+' assignment change(s)</div><div style="font-size:.7rem;margin-top:4px">Server transaction: '+escText(ws.serverTransactionId||"Not submitted")+'</div><div style="margin-top:5px"><button data-scenario-next="'+ws.id+'" data-next="'+next+'">'+(next==="REVIEW"?"SUBMIT FOR REVIEW":next==="APPROVED"?"APPROVE":next==="APPLIED"?"EXECUTE":"ARCHIVE")+'</button></div><small>Audit entries: '+(ws.audit?.length||0)+'</small></div>';
  }).join("")||'<small>No scenarios available for approval.</small>';
  box.querySelectorAll("[data-scenario-next]").forEach(b=>b.onclick=async()=>{const n=b.dataset.next;if(n){await creatorNavScenarioTransition(b.dataset.scenarioNext,n);renderScenarioApprovalEngine();}});
}
function renderScenarioComparisonMatrix(){
  const box=document.getElementById("creatorNavScenarioComparison");if(!box)return;
  const rows=creatorNavScenarioMatrix(data);
  box.innerHTML=rows.length?'<div style="overflow:auto"><table style="width:100%;font-size:.72rem;border-collapse:collapse"><thead><tr><th>Scenario</th><th>Completion</th><th>Throughput</th><th>Utilization</th><th>Deadline</th><th>Dependencies</th><th>Recovery</th><th>Impact</th><th></th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+escText(r.name)+'</td><td>'+escText(String(r.completionDays??"—"))+' days</td><td>'+r.simulation.throughput.toFixed(1)+'</td><td>'+r.workload+'%</td><td>'+escText(String(r.simulation.deadlines[0]?.date||"—"))+'</td><td>'+r.dependencyRisk+'</td><td>'+r.recoveryImpact+'</td><td>'+r.productionImpact+'</td><td><button data-scenario-select="'+r.id+'">SELECT</button></td></tr>').join("")+'</tbody></table></div>':'<small>Save scenarios to compare them side-by-side.</small>';
  box.querySelectorAll("[data-scenario-select]").forEach(b=>b.onclick=()=>{creatorNavScenarioSelect(b.dataset.scenarioSelect);renderScenarioComparisonMatrix();});
}
function renderScenarioWorkspace(){
  const box=document.getElementById("creatorNavScenarioWorkspace");if(!box)return;
  const all=creatorNavScenarioWorkspacesRead(),rows=Object.values(all).slice(-12).reverse();
  box.innerHTML='<div style="font-size:.75rem">Save and review multi-change production scenarios before applying them.</div><button id="creatorNavSaveWorkspace" style="margin-top:6px">SAVE CURRENT WHAT-IF</button><div style="margin-top:7px">'+rows.map(w=>{const sim=creatorNavSimulation(data,w.options);return '<div class="card" style="padding:7px;margin-top:5px"><b>'+escText(w.name)+'</b><small> · '+escText(w.status)+'</small><div>Throughput '+sim.throughput.toFixed(1)+' · Capacity '+sim.capacity+' · Utilization '+sim.utilization+'% · Blocked '+sim.blocked+'</div><div style="margin-top:4px"><button data-ws-apply="'+w.id+'">APPLY SCENARIO</button> <button data-ws-delete="'+w.id+'">DELETE</button></div></div>';}).join("")+'</div>';
  box.querySelector("#creatorNavSaveWorkspace").onclick=()=>{const name=prompt("Scenario name","Production Scenario");if(name){creatorNavScenarioWorkspaceSave(name,{capacityBoost:Number(box.querySelector("[data-sim-capacity]")?.value||0),rateMultiplier:Number(box.querySelector("[data-sim-rate]")?.value||1),deadlineShift:Number(box.querySelector("[data-sim-days]")?.value||0)});renderScenarioWorkspace();}};
  box.querySelectorAll("[data-ws-apply]").forEach(b=>b.onclick=async()=>{if(confirm("Submit this scenario to the server governance approval gate?")){await creatorNavScenarioWorkspaceApply(data,b.dataset.wsApply);renderScenarioWorkspace();renderScenarioApprovalEngine();}});
  box.querySelectorAll("[data-ws-delete]").forEach(b=>b.onclick=()=>{creatorNavScenarioWorkspaceDelete(b.dataset.wsDelete);renderScenarioWorkspace();});
}
function renderOptimizationSimulator(){
  const box=document.getElementById("creatorNavOptimizationSimulator");if(!box)return;
  const cap=Number(box.querySelector("[data-sim-capacity]")?.value||0),rate=Number(box.querySelector("[data-sim-rate]")?.value||1),days=Number(box.querySelector("[data-sim-days]")?.value||0);
  const c=creatorNavSimulationCompare(data,{capacityBoost:cap,rateMultiplier:rate,deadlineShift:days}),d=c.delta;
  box.querySelector("[data-sim-results]").innerHTML='<div class="card" style="padding:8px;margin-top:7px"><b>BASELINE</b><div>Throughput '+c.base.throughput.toFixed(1)+' · Capacity '+c.base.capacity+' · Utilization '+c.base.utilization+'%</div></div><div class="card" style="padding:8px;margin-top:5px"><b>SIMULATION</b><div>Throughput '+c.test.throughput.toFixed(1)+' ('+(d.throughput>=0?"+":"")+d.throughput+') · Capacity '+c.test.capacity+' ('+(d.capacity>=0?"+":"")+d.capacity+') · Utilization '+c.test.utilization+'% ('+(d.utilization>=0?"+":"")+d.utilization+' pts)</div><div>Ready '+c.test.ready+' · Blocked '+c.test.blocked+'</div></div><small>Simulation is preview-only. No assignments or production data are changed.</small>';
}
function renderOptimizationSimulatorPanel(){
  const box=document.getElementById("creatorNavOptimizationSimulator");if(!box)return;
  box.innerHTML='<div style="font-size:.75rem">Preview production changes before applying them.</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:6px"><label>Capacity +<input data-sim-capacity type="number" min="0" value="0"></label><label>Rate ×<input data-sim-rate type="number" min=".1" step=".1" value="1"></label><label>Deadline days<input data-sim-days type="number" value="0"></label></div><button id="creatorNavRunSimulation" style="margin-top:7px">RUN WHAT-IF</button><div data-sim-results></div>';
  box.querySelector("#creatorNavRunSimulation").onclick=renderOptimizationSimulator;
}
function renderAutonomousOptimizer(){
  const box=document.getElementById("creatorNavAutonomousOptimizer");if(!box)return;
  const r=creatorNavGlobalOptimization(data);
  box.innerHTML='<div style="font-size:.75rem">Global plan: <b>'+r.plan.length+'</b> ready tasks · <b>'+r.blocked.length+'</b> blocked · generated '+new Date(r.generatedAt).toLocaleTimeString()+'</div>'+r.plan.slice(0,20).map(t=>'<div class="card" style="padding:7px;margin-top:5px"><b>'+escText(t.name)+'</b><small> · '+escText(t.collection)+'</small><div>→ <b>'+escText(t.recommended.member.name)+'</b> · score '+t.recommended.score+' · '+t.recommended.utilization+'% planned utilization</div></div>').join("")+'<button id="creatorNavApplyOptimizer" style="margin-top:7px">APPLY GLOBAL PLAN</button>';
  const b=document.getElementById("creatorNavApplyOptimizer");if(b)b.onclick=()=>{const n=creatorNavOptimizerApply(r);b.textContent="APPLIED "+n+" ASSIGNMENTS";renderAutonomousOptimizer();};
}
function renderIntelligentAssignments(){
  const box=document.getElementById("creatorNavIntelligentAssignments");if(!box)return;
  const rows=creatorNavAssignmentRecommendations(data).filter(r=>r.best&&r.dependency.state==="READY").slice(0,25);
  box.innerHTML=rows.map(r=>'<div class="card" style="padding:7px;margin-top:6px"><b>'+escText(r.name)+'</b><small> · '+escText(r.collection)+'</small><div style="margin-top:4px">RECOMMENDED: <b>'+escText(r.best.member.name)+'</b> · score '+r.best.score+' · '+r.best.utilization+'% utilized · '+r.best.completionRate+'% completion'+(r.current&&r.current.member.id===r.best.member.id?' · CURRENT':'')+'</div><button data-smart-id="'+escText(r.collectionId)+'" data-smart-key="'+escText(r.key)+'" data-smart-member="'+escText(r.best.member.id)+'" style="margin-top:5px">ASSIGN RECOMMENDATION</button></div>').join("")||'<small>No ready tasks require assignment recommendations.</small>';
  box.querySelectorAll("[data-smart-id]").forEach(b=>b.onclick=()=>{creatorNavApplyRecommendedAssignment(b.dataset.smartId,b.dataset.smartKey,b.dataset.smartMember);renderIntelligentAssignments();});
}
function renderCreatorPerformanceIntelligence(){
  const box=document.getElementById("creatorNavCreatorPerformance");if(!box)return;
  const rows=creatorNavPerformanceRecommendations(data);
  box.innerHTML=rows.map(p=>'<div class="card" style="padding:8px;margin-top:7px"><b>'+escText(p.member.name)+'</b><small> · '+escText(p.member.role||"Creator")+'</small><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:5px;margin-top:6px">'+[
    ["Completion",p.completionRate+"%"],["Open",p.open],["Utilization",p.utilization+"%"],["Streak",p.streak+" days"],["Contributions",p.contribution],["Bottlenecks",p.bottlenecks],["Deadline Reliability",p.deadlineReliability===null?"—":p.deadlineReliability+"%"]
  ].map(x=>'<span><b>'+escText(String(x[1]))+'</b><small> '+escText(x[0])+'</small></span>').join("")+'</div>'+(p.recommendations.length?'<div style="margin-top:6px"><small>RECOMMENDATIONS: '+p.recommendations.map(escText).join(" · ")+'</small></div>':'')+'</div>').join("")||'<small>No active creators.</small>';
}
function renderProductionIntelligence(){
  const box=document.getElementById("creatorNavProductionIntelligence");if(!box)return;
  const p=creatorNavProductionIntelligence(data),trend=creatorNavEventsRead().slice(-12);
  box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px;margin-top:8px">'+[
    ["Completion",p.completion+"%"],["Open Tasks",p.open],["Throughput",p.velocity.toFixed(1)+" pts/day"],["Conflicts",p.conflicts],["Overdue",p.overdue],["Utilization",p.utilization+"%"],["Blocked",p.dependencyBottlenecks],["Recovery",p.recovery]
  ].map(x=>'<div class="card" style="padding:7px"><b>'+escText(String(x[1]))+'</b><small> '+escText(x[0].toUpperCase())+'</small></div>').join("")+'</div><div style="margin-top:10px"><b>CREATOR PERFORMANCE</b>'+p.workload.map(r=>'<div style="font-size:.74rem;margin-top:4px">'+escText(r.member.name)+' · '+r.load+' assigned / '+Number(r.member.capacity||0)+' capacity'+(r.over?' · ⚠ OVER':'')+'</div>').join("")+'</div><div style="margin-top:10px"><b>SCHEDULE HEALTH</b><div style="font-size:.74rem;margin-top:4px">'+(p.conflicts?'Schedule has '+p.conflicts+' active conflict(s), including '+p.overdue+' overdue.':'No active schedule conflicts.')+'</div></div><div style="margin-top:10px"><b>HISTORICAL PRODUCTION TREND</b><div style="display:flex;gap:3px;align-items:flex-end;height:70px;margin-top:6px">'+trend.map(e=>'<span title="'+escText(creatorNavEventTypeLabel(e.type))+'" style="display:block;width:10px;height:'+Math.max(8,Math.min(64,8+((new Date(e.at).getTime()/86400000)%7)*8))+'px;border:1px solid currentColor"></span>').join("")+'</div><small>Recent production-event activity · '+trend.length+' events shown</small></div>';
}
function renderProductionControlRoom(){
  const box=document.getElementById("creatorNavLiveControlRoom");if(!box)return;
  const q=creatorNavControlRoomState(data),over=q.workload.filter(x=>x.over).length;
  box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-top:7px"><div class="card" style="padding:7px"><b>'+q.adaptive.collections.reduce((n,c)=>n+c.rows.length,0)+'</b><small> OPEN TASKS</small></div><div class="card" style="padding:7px"><b>'+q.adaptive.conflicts.length+'</b><small> CONFLICTS</small></div><div class="card" style="padding:7px"><b>'+over+'</b><small> OVER CAPACITY</small></div><div class="card" style="padding:7px"><b>'+q.handoffs.length+'</b><small> RECENT HANDOFFS</small></div></div><div style="margin-top:8px"><b>LIVE TEAM CAPACITY</b>'+q.workload.map(r=>'<div style="font-size:.74rem;margin-top:3px">'+escText(r.member.name)+' · '+r.load+'/'+Number(r.member.capacity||0)+(r.over?' · ⚠ OVER':'')+'</div>').join("")+'</div><div style="margin-top:8px"><b>LIVE CONFLICTS</b>'+ (q.adaptive.conflicts.slice(0,8).map(c=>'<div style="font-size:.74rem;margin-top:3px">⚠ '+escText(c.collection)+' · '+escText(c.task)+' · '+escText(c.status)+'</div>').join("")||'<div style="font-size:.74rem;opacity:.7">No conflicts.</div>')+'</div><div style="margin-top:8px"><b>HANDOFF ACTIVITY</b>'+ (q.handoffs.slice(-6).reverse().map(h=>'<div style="font-size:.72rem;margin-top:3px">'+escText(h.collection)+' · '+escText(h.from||"—")+' → '+escText(h.to||"—")+(h.note?' · '+escText(h.note):"")+'</div>').join("")||'<div style="font-size:.72rem;opacity:.7">No recent handoffs.</div>')+'</div><div style="margin-top:8px"><b>EXECUTION ACTIVITY</b>'+ (q.activity.slice(-8).reverse().map(h=>'<div style="font-size:.72rem;margin-top:3px">'+escText(h.collection)+' · '+escText(h.type||"task")+' · '+escText(h.name||h.key||"activity")+'</div>').join("")||'<div style="font-size:.72rem;opacity:.7">No recent activity.</div>')+'</div>';
}
function renderAdaptiveSchedule(){
  const box=document.getElementById("creatorNavAdaptiveSchedule");if(!box)return;
  const a=creatorNavAdaptiveSchedule(data),q=creatorNavAdaptiveSummary(a);
  box.innerHTML='<div style="font-size:.75rem;margin-top:6px">'+q.tasks+' open tasks · '+q.conflicts+' conflicts · '+q.overdue+' overdue</div>'+ (a.conflicts.length?'<div style="margin-top:6px">'+a.conflicts.slice(0,15).map(c=>'<div style="font-size:.74rem;margin-top:3px">⚠ '+escText(c.collection)+' · '+escText(c.task)+' · '+escText(c.owner)+' · '+escText(c.status)+' · '+escText(c.action)+'</div>').join("")+'</div>':'<div style="font-size:.74rem;opacity:.7;margin-top:5px">No current schedule conflicts.</div>')+'<div style="margin-top:7px"><b>RECOVERY SCHEDULE</b>'+a.collections.map(c=>'<div style="font-size:.74rem;margin-top:3px"><b>'+escText(c.name)+'</b>: '+(c.rows.slice(0,5).map((r,i)=>(i+1)+'. '+escText(r.name)+' → '+r.date.toISOString().slice(0,10)).join(" · ")||"Complete")+'</div>').join("")+'</div>';
}
;