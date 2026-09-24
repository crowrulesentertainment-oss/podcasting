import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#notifications");let user,channel;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const typeLabel=t=>({follower:"NEW FOLLOWER",subscriber:"NEW SUBSCRIBER",milestone:"EPISODE MILESTONE",revenue:"REVENUE EVENT",publishing:"PUBLISHING",distribution:"DISTRIBUTION",system:"SYSTEM"}[t]||String(t||"ALERT").toUpperCase());
const icon=t=>({follower:"◉",subscriber:"◆",milestone:"★",revenue:"$",publishing:"▶",distribution:"◎",system:"⚙"}[t]||"•");
let prefs={group_window_minutes:15};
async function load(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const auth=await db.auth.getUser();user=auth.data.user;if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to view creator notifications.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const pr=await db.from("podcast_notification_preferences").select("*").eq("user_id",user.id).maybeSingle();if(pr.data)prefs=pr.data;
 const res=await db.from("podcast_creator_notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);if(res.error)throw res.error;
 render(res.data||[]);
}
function groupRows(rows){
 const mins=Math.max(0,Number(prefs.group_window_minutes||0));if(!mins)return rows.map(n=>({items:[n],latest:n}));
 const groups=[];for(const n of rows){const g=groups.find(x=>x.latest.notification_type===n.notification_type&&Math.abs(new Date(x.latest.created_at)-new Date(n.created_at))<=mins*60000);if(g)g.items.push(n);else groups.push({items:[n],latest:n})}return groups;
}
function render(rows){
 const unread=rows.filter(x=>!x.is_read).length,groups=groupRows(rows);
 root.innerHTML='<div class="toolbar"><span class="badge-dot"></span><b>'+unread+' unread</b><span class="muted">'+groups.length+' alert groups</span><a class="btn" href="notification-settings.html">Intelligence Settings</a><button class="btn" id="readAll">Mark all read</button><button class="btn" id="refresh">Refresh</button></div>'+ (groups.length?groups.map(g=>{const n=g.latest,items=g.items,unreadGroup=items.filter(x=>!x.is_read).length;const summary=items.length>1?(n.title+' • '+items.length+' related alerts'):(n.title);return '<article class="panel notification '+(unreadGroup?"unread":"")+'"><div><div class="eyebrow">'+icon(n.notification_type)+' '+typeLabel(n.notification_type)+'</div><h3>'+esc(summary)+'</h3><p>'+esc(n.message)+(items.length>1?' <span class="muted">('+unreadGroup+' unread)</span>':"")+'</p><small class="muted">'+new Date(n.created_at).toLocaleString()+'</small>'+(items.length>1?'<details><summary>View grouped alerts</summary>'+items.map(x=>'<p class="grouped-item">'+esc(x.message)+' <small class="muted">'+new Date(x.created_at).toLocaleTimeString()+'</small></p>').join("")+'</details>':"")+'</div><div class="actions">'+(unreadGroup?'<button class="btn" data-read-group="'+items.map(x=>x.id).join(",")+'">Mark group read</button>':"")+(n.action_url?'<a class="btn primary" href="'+esc(n.action_url)+'">Open</a>':"")+'</div></article>'}).join(""):'<div class="panel empty"><h2>No notifications yet.</h2><p>Creator alerts will appear here as your podcast activity grows.</p></div>');
 document.getElementById("readAll")?.addEventListener("click",async()=>{await db.from("podcast_creator_notifications").update({is_read:true}).eq("user_id",user.id).eq("is_read",false);load()});
 document.getElementById("refresh")?.addEventListener("click",load);
 root.querySelectorAll("[data-read-group]").forEach(b=>b.onclick=async()=>{for(const id of b.dataset.readGroup.split(","))await db.from("podcast_creator_notifications").update({is_read:true}).eq("id",id).eq("user_id",user.id);load()});
}
async function realtime(){
 channel=db.channel("creator-notifications-intelligence").on("postgres_changes",{event:"INSERT",schema:"public",table:"podcast_creator_notifications",filter:"user_id=eq."+user.id},payload=>{load();if(window.__CR_TOAST)window.__CR_TOAST(payload.new.title)}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"podcast_notification_preferences",filter:"user_id=eq."+user.id},load);
 channel.subscribe();
}
load().then(realtime).catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Notifications could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});
