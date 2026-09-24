import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#actionsPage");let user,rows=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[m]));
const statusLabel={open:"Open",in_progress:"In Progress",completed:"Completed",dismissed:"Dismissed"};
const typeLabel={publishing:"Publishing",audience:"Audience",followers:"Followers",subscriptions:"Subscriptions",monetization:"Monetization",distribution:"Distribution",retention:"Retention",milestone:"Milestone",review:"Review",other:"Other"};
function render(filter="all"){
 const counts={open:0,in_progress:0,completed:0,dismissed:0};rows.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
 const visible=filter==="all"?rows:rows.filter(x=>x.status===filter);
 root.innerHTML='<div class="action-grid"><div class="panel action-stat"><span class="muted">Open</span><strong>'+counts.open+'</strong></div><div class="panel action-stat"><span class="muted">In Progress</span><strong>'+counts.in_progress+'</strong></div><div class="panel action-stat"><span class="muted">Completed</span><strong>'+counts.completed+'</strong></div><div class="panel action-stat"><span class="muted">Total</span><strong>'+rows.length+'</strong></div></div>'+
 '<div class="action-tabs">'+["all","open","in_progress","completed","dismissed"].map(x=>'<button class="btn '+(x===filter?"active":"")+'" data-filter="'+x+'">'+(x==="all"?"All":statusLabel[x])+'</button>').join("")+'</div>'+
 '<div class="action-list">'+(visible.length?visible.map(card).join(""):'<div class="panel empty"><h2>No actions in this view.</h2><p>Your next automated action set will appear after weekly intelligence runs.</p></div>')+'</div>';
 document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>render(b.dataset.filter));
 document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>changeStatus(b.dataset.id,b.dataset.status));
}
function card(x){
 const p=Math.max(1,Math.min(5,Number(x.priority||3)));
 return '<article class="panel action-row"><div class="priority">P'+p+'</div><div><span class="chip">'+esc(typeLabel[x.action_type]||x.action_type)+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><div class="action-meta"><span class="chip">'+esc(statusLabel[x.status]||x.status)+'</span><span class="chip">'+new Date(x.created_at).toLocaleDateString()+'</span></div></div><div class="actions">'+(x.status==="open"?'<button class="btn primary" data-status="in_progress" data-id="'+x.id+'">Start</button>':"")+(x.status==="in_progress"?'<button class="btn primary" data-status="completed" data-id="'+x.id+'">Complete</button>':"")+(x.status!=="completed"&&x.status!=="dismissed"?'<button class="btn" data-status="dismissed" data-id="'+x.id+'">Dismiss</button>':"")+'</div></article>';
}
async function changeStatus(id,status){
 const patch={status,updated_at:new Date().toISOString()};
 if(status==="in_progress")patch.started_at=new Date().toISOString();
 if(status==="completed")patch.completed_at=new Date().toISOString();
 const {error}=await db.from("podcast_creator_actions").update(patch).eq("id",id).eq("user_id",user.id);
 if(error){alert(error.message);return} await load();
}
async function load(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const a=await db.auth.getUser();user=a.data.user;
 if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to open the Action Center.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const q=await db.from("podcast_creator_actions").select("*").eq("user_id",user.id).order("status",{ascending:true}).order("priority",{ascending:true}).order("created_at",{ascending:false});
 if(q.error)throw q.error;rows=q.data||[];render();
}
load().catch(e=>{root.innerHTML='<div class="panel empty"><h2>Action Center could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});