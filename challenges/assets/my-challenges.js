import{sb}from"../../assets/js/client.js";
const root=document.querySelector("#my-challenges");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function init(){
 const{data:{user}}=await sb.auth.getUser();
 if(!user){root.innerHTML='<div class="notice">Sign in to view your Challenge Episodes and creator achievements. <a class="btn" href="../../login.html?next='+encodeURIComponent(location.pathname)+'">Sign in</a></div>';return}
 const profile=await sb.from("creator_profiles").select("id").eq("user_id",user.id).maybeSingle();
 let badges=[];
 if(profile.data?.id){
  const br=await sb.from("podcast_badge_assignments").select("badge_key,awarded_at,podcast_badge_catalog(name,description,image_url,icon)").eq("target_type","profile").eq("target_id",profile.data.id).order("awarded_at",{ascending:false});
  if(!br.error)badges=br.data||[];
 }
 const s=await sb.from("podcast_challenge_submissions").select("id,challenge_id,episode_title,status,submitted_at,episode_slug,published_at").eq("creator_user_id",user.id).order("submitted_at",{ascending:false});
 if(s.error)throw s.error;
 const rows=s.data||[];
 let publicRows=[];
 if(rows.length){const r=await sb.from("podcast_challenge_episodes_public").select("*").in("id",rows.map(x=>x.id));if(!r.error)publicRows=r.data||[]}
 const badgeHtml=badges.map(b=>{const m=b.podcast_badge_catalog||{};return '<article class="badge"><div class="seal">'+(m.image_url?'<img src="'+esc(m.image_url)+'" alt="" style="width:58px;height:58px;object-fit:contain">':esc(m.icon||"🏅"))+'</div><h3>'+esc(m.name||b.badge_key)+'</h3><p>'+esc(m.description||"CrowRules creator recognition.")+'</p><small>'+new Date(b.awarded_at).toLocaleDateString()+'</small></article>'}).join("");
 const entriesHtml=rows.map(r=>'<article class="event-row"><div><b>'+esc(r.episode_title)+'</b><small>'+esc(r.status)+' · '+new Date(r.submitted_at).toLocaleDateString()+'</small></div>'+(publicRows.some(p=>p.id===r.id)?'<a class="btn" href="../episodes/index.html?episode='+r.id+'">Open public episode ↗</a>':'<span class="pill">'+(r.status==="pending"?"Awaiting review":r.status==="approved"?"Approved — awaiting public consent":"Not published")+'</span>')+'</article>').join("");
 root.innerHTML='<div class="grid3"><article class="feature"><b>'+rows.length+'</b><p>SUBMISSIONS</p></article><article class="feature"><b>'+publicRows.length+'</b><p>PUBLISHED CHALLENGE EPISODES</p></article><article class="feature"><b>'+badges.length+'</b><p>CREATOR ACHIEVEMENTS</p></article></div><section class="section"><div class="section-head"><div><div class="eyebrow">Your challenge history</div><h2>Challenge Episodes</h2></div></div>'+(entriesHtml||'<div class="episode-empty">You have not submitted a challenge entry yet.</div>')+'</section><section class="section"><div class="section-head"><div><div class="eyebrow">Your milestones</div><h2>Creator recognition</h2></div></div><div class="badges">'+(badgeHtml||'<div class="episode-empty">Your challenge badges will appear here when earned. Founding Creator 2026 is permanent recognition for eligible participation in either 2026 pilot.</div>')+'</div></section>';
}
init().catch(e=>root.innerHTML='<div class="notice">'+esc(e.message)+'</div>');
