import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#notifications");let user,channel;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const typeLabel=t=>({follower:"NEW FOLLOWER",subscriber:"NEW SUBSCRIBER",milestone:"EPISODE MILESTONE",revenue:"REVENUE EVENT",publishing:"PUBLISHING",distribution:"DISTRIBUTION",system:"SYSTEM"}[t]||String(t||"ALERT").toUpperCase());
async function load(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const auth=await db.auth.getUser();user=auth.data.user;if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to view creator notifications.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 render((await db.from("podcast_creator_notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)).data||[]);
}
function render(rows){
 const unread=rows.filter(x=>!x.is_read).length;
 root.innerHTML='<div class="toolbar"><span class="badge-dot"></span><b>'+unread+' unread</b><button class="btn" id="readAll">Mark all read</button><button class="btn" id="refresh">Refresh</button></div>'+ (rows.length?rows.map(n=>'<article class="panel notification '+(n.is_read?"":"unread")+'"><div><h3>'+esc(n.title)+'</h3><p>'+esc(n.message)+'</p><small class="muted">'+typeLabel(n.notification_type)+' • '+new Date(n.created_at).toLocaleString()+'</small></div><div class="actions">'+(!n.is_read?'<button class="btn" data-read="'+n.id+'">Mark read</button>':"")+(n.action_url?'<a class="btn primary" href="'+esc(n.action_url)+'">Open</a>':"")+'</div></article>').join(""):'<div class="panel empty"><h2>No notifications yet.</h2><p>Creator alerts will appear here as your podcast activity grows.</p></div>');
 document.getElementById("readAll").onclick=async()=>{await db.from("podcast_creator_notifications").update({is_read:true}).eq("user_id",user.id).eq("is_read",false);load()};
 document.getElementById("refresh").onclick=load;
 root.querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{await db.from("podcast_creator_notifications").update({is_read:true}).eq("id",b.dataset.read).eq("user_id",user.id);load()});
}
async function realtime(){
 channel=db.channel("creator-notifications").on("postgres_changes",{event:"INSERT",schema:"public",table:"podcast_creator_notifications",filter:"user_id=eq."+user.id},payload=>{load();if(window.__CR_TOAST)window.__CR_TOAST(payload.new.title)});
 channel.subscribe();
}
load().then(realtime).catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Notifications could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});
