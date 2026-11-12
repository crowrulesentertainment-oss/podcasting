import { sb } from "../../assets/js/client.js";
const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root=$("#admin-root"),status=$("#admin-status");let user=null,events=[],entries=[];
const say=s=>status.textContent=s;
async function init(){const auth=await sb.auth.getUser();user=auth.data.user;if(!user){root.innerHTML='<div class="notice">Sign in with an administrator account to continue. <a href="../../login.html">Sign in</a></div>';return}
 const {data:admin,error}=await sb.from("cr_admins").select("user_id,role,is_active").eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(error||!admin){root.innerHTML='<div class="notice"><b>Restricted area.</b><p>This page is available to active CrowRules administrators.</p></div>';return}
 await load();
}
async function load(){say("Loading pilot challenges and submissions…");
 const c=await sb.from("podcast_monthly_challenges").select("*").eq("challenge_year",2026).in("challenge_code",["CRPC-2026-PILOT-11","CRPC-2026-PILOT-12"]).order("challenge_month");
 if(c.error){say(c.error.message);return}events=c.data||[];
 const ids=events.map(x=>x.id);if(!ids.length){root.innerHTML='<div class="notice">No 2026 pilot challenge records were found.</div>';return}
 const r=await sb.from("podcast_challenge_submissions").select("*").in("challenge_id",ids).order("submitted_at",{ascending:false});
 if(r.error){say(r.error.message);return}entries=r.data||[];render();say("Loaded "+events.length+" pilot events and "+entries.length+" entries.");
}
function render(){const pending=entries.filter(x=>x.status==="pending").length,approved=entries.filter(x=>x.status==="approved").length;
 $("#admin-stats").innerHTML=[["PILOT EVENTS",events.length],["PENDING REVIEW",pending],["APPROVED",approved],["FOUNDING BADGES","Automatic"]].map(x=>'<div class="stat"><b>'+x[1]+'</b><small>'+x[0]+'</small></div>').join("");
 $("#admin-events").innerHTML=events.map(e=>'<article class="event-row"><div><b>'+esc(e.title)+'</b><small>'+esc(e.challenge_code)+' · '+new Date(e.submission_opens_at).toLocaleDateString()+' – '+new Date(e.submission_closes_at).toLocaleDateString()+'</small></div><span class="status">'+esc(e.status)+'</span></article>').join("");
 const list=$("#admin-entries");list.innerHTML=entries.map(e=>{const challenge=events.find(x=>x.id===e.challenge_id);return '<article class="review-card"><div class="review-head"><div><span class="eyebrow">'+esc(challenge?.title||"Pilot event")+'</span><h3>'+esc(e.episode_title)+'</h3><p>'+esc(e.show_name)+' · Submitted '+new Date(e.submitted_at).toLocaleString()+'</p></div><span class="status '+esc(e.status)+'">'+esc(e.status)+'</span></div><p class="statement">'+esc(e.creator_statement||"No creator note provided.")+'</p><p><a href="'+esc(e.episode_url)+'" target="_blank" rel="noopener noreferrer">Open submitted episode ↗</a></p><p class="consent-state">'+(e.public_display_consent?"Public showcase permission: granted":"Public showcase permission: not granted")+'</p>'+(e.status==="pending"?'<div class="actions"><button class="btn" data-action="approved" data-id="'+e.id+'">Approve entry</button><button class="btn danger" data-action="rejected" data-id="'+e.id+'">Reject entry</button></div>':"")+'</article>'}).join("")||'<div class="notice">No submissions have been received yet.</div>';
 list.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",async()=>{const entry=entries.find(x=>x.id===button.dataset.id);if(!entry)return;const action=button.dataset.action,confirmText=action==="approved"?"Approve this qualifying entry? If this is a 2026 pilot entry, the permanent Founding Creator badge will be awarded automatically.":"Reject this entry?";if(!confirm(confirmText))return;button.disabled=true;const {error}=await sb.from("podcast_challenge_submissions").update({status:action,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_notes:null,updated_at:new Date().toISOString()}).eq("id",entry.id);if(error){say(error.message);button.disabled=false;return}await load();say(action==="approved"?"Entry approved. Founding Creator recognition was processed by the database workflow if the creator has a profile.":"Entry rejected.");}));
}
$("#admin-refresh").addEventListener("click",load);init().catch(e=>say(e.message));
