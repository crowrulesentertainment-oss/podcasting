import{sb}from"./client.js";import{SITE_BASE}from"./config.js";
const root=document.querySelector("#reviewerHub"),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1),monthValue=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),monthLabel=d=>d.toLocaleDateString(undefined,{month:"long",year:"numeric"});
const profileLink=p=>SITE_BASE+"profile.html?username="+encodeURIComponent(p?.username||"");
const avatar=(url,name)=>url?'<img src="'+esc(url)+'" alt="">':'<span>'+esc((name||"C").slice(0,1).toUpperCase())+'</span>';
function person(p){const name=p.display_name||p.username||"Community member";return'<a class="cr-rec-person" href="'+profileLink(p)+'">'+avatar(p.avatar_url,name)+'<span><b>'+esc(name)+'</b><small>@'+esc(p.username||"member")+'</small></span></a>'}
function stars(n){return'<span class="cr-review-stars" aria-label="'+Number(n)+' out of 5 stars">'+'★'.repeat(Number(n)||0)+'☆'.repeat(5-(Number(n)||0))+'</span>'}
async function featuredReviews(){
 const[shows,episodes]=await Promise.all([
  sb.from("podcast_reviews").select("id,user_id,podcast_id,rating,title,body,created_at,featured_at").eq("status","published").not("featured_at","is",null).order("featured_at",{ascending:false}).limit(8),
  sb.from("podcast_episode_reviews").select("id,user_id,episode_id,rating,title,body,created_at,featured_at").eq("status","published").not("featured_at","is",null).order("featured_at",{ascending:false}).limit(8)
 ]);
 if(shows.error)throw shows.error;if(episodes.error)throw episodes.error;
 const rows=[...(shows.data||[]).map(x=>({...x,kind:"show"})),...(episodes.data||[]).map(x=>({...x,kind:"episode"}))].sort((a,b)=>new Date(b.featured_at)-new Date(a.featured_at)).slice(0,8);
 if(!rows.length)return'<div class="cr-rec-empty">Featured listener reviews will appear here when the CrowRules team selects them.</div>';
 const ids=[...new Set(rows.map(x=>x.user_id))],showIds=rows.filter(x=>x.kind==="show").map(x=>x.podcast_id),episodeIds=rows.filter(x=>x.kind==="episode").map(x=>x.episode_id);
 const[profiles,showsById,episodesById]=await Promise.all([
  sb.from("crowrules_public_profiles").select("user_id,username,display_name,first_name,last_name,avatar_url").in("user_id",ids),
  showIds.length?sb.from("podcasts").select("id,title").in("id",showIds):Promise.resolve({data:[]}),
  episodeIds.length?sb.from("podcast_episodes").select("id,title").in("id",episodeIds):Promise.resolve({data:[]})
 ]);
 const people=new Map((profiles.data||[]).map(x=>[x.user_id,x])),showMap=new Map((showsById.data||[]).map(x=>[x.id,x])),episodeMap=new Map((episodesById.data||[]).map(x=>[x.id,x]));
 return rows.map(r=>{const p=people.get(r.user_id)||{username:"community"},target=r.kind==="show"?showMap.get(r.podcast_id):episodeMap.get(r.episode_id),url=SITE_BASE+(r.kind==="show"?"show.html?id=":"episode.html?id=")+encodeURIComponent(r.kind==="show"?r.podcast_id:r.episode_id);return'<article class="cr-rec-feature"><div class="cr-rec-feature-top"><span>✦ FEATURED '+(r.kind==="show"?"SHOW":"EPISODE")+' REVIEW</span>'+stars(r.rating)+'</div><h3>'+esc(r.title||"Listener review")+'</h3><p>'+esc(r.body||"")+'</p><div class="cr-rec-feature-foot">'+person(p)+'<a href="'+url+'">Read review ↗</a></div><small class="cr-rec-target">On '+esc(target?.title||"a CrowRules title")+'</small></article>'}).join("");
}
async function renderLeaderboard(month){
 const{data,error}=await sb.rpc("get_podcast_monthly_reviewer_leaderboard",{p_month:monthValue(month)+"-01"});if(error)throw error;
 const rows=data||[];if(!rows.length)return'<div class="cr-rec-empty">No published reviews have been counted for this month yet. Be the first voice on the board.</div>';
 return'<div class="cr-rec-leaderboard">'+rows.slice(0,20).map((r,i)=>'<article class="cr-rec-rank '+(i===0?"is-first":"")+'"><span class="cr-rec-rank-number">'+(r.leaderboard_rank||i+1)+'</span>'+person(r)+'<span class="cr-rec-rank-stat"><b>'+Number(r.helpful_votes||0)+'</b><small>HELPFUL</small></span><span class="cr-rec-rank-stat"><b>'+Number(r.review_count||0)+'</b><small>REVIEWS</small></span></article>').join("")+'</div>';
}
async function init(){
 if(!root)return;
 const now=monthStart(new Date());let month=now;
 root.innerHTML='<div class="cr-rec-loading">Loading reviewer recognition…</div>';
 try{
  const[badgeResult,awardResult,featuredHtml,leaderHtml]=await Promise.all([
   sb.from("podcast_review_badge_catalog").select("badge_key,name,description,icon").eq("is_active",true).order("name"),
   sb.from("podcast_review_badge_awards").select("badge_key,user_id,awarded_at,note").eq("is_public",true).order("awarded_at",{ascending:false}).limit(12),
   featuredReviews(),renderLeaderboard(month)
  ]);
  if(badgeResult.error)throw badgeResult.error;if(awardResult.error)throw awardResult.error;
  const awardIds=[...new Set((awardResult.data||[]).map(x=>x.user_id))],awardKeys=[...new Set((awardResult.data||[]).map(x=>x.badge_key))];
  const[profiles,badges]=await Promise.all([
   awardIds.length?sb.from("crowrules_public_profiles").select("user_id,username,display_name,first_name,last_name,avatar_url").in("user_id",awardIds):Promise.resolve({data:[]}),
   awardKeys.length?sb.from("podcast_review_badge_catalog").select("badge_key,name,icon").in("badge_key",awardKeys):Promise.resolve({data:[]})
  ]);
  const people=new Map((profiles.data||[]).map(x=>[x.user_id,x])),badgeMap=new Map((badges.data||[]).map(x=>[x.badge_key,x]));
  root.innerHTML='<div class="cr-rec-shell"><header class="cr-rec-nav"><a href="'+SITE_BASE+'index.html">CROWRULES <b>PODCASTING</b></a><nav><a href="'+SITE_BASE+'profiles.html">Community</a><a class="active" href="'+SITE_BASE+'reviewers.html">Reviewer Hub</a><a href="'+SITE_BASE+'discover.html">Discover Shows</a></nav></header><section class="cr-rec-hero"><div><span class="cr-rec-kicker">THE PEOPLE WHO MAKE THE CONVERSATION MATTER</span><h1>Every review<br><em>has a voice.</em></h1><p>Celebrate the listeners who share thoughtful feedback, help others discover great shows and strengthen the CrowRules community.</p><a class="cr-rec-cta" href="'+SITE_BASE+'discover.html">Find a show to review ↗</a></div><div class="cr-rec-hero-mark">✦<small>LISTEN · REVIEW · RECOGNIZE</small></div></section><section class="cr-rec-section"><div class="cr-rec-section-head"><div><span class="cr-rec-kicker">COMMUNITY SPOTLIGHT</span><h2>Monthly reviewer leaderboard</h2><p>Rankings are based on helpful votes received by reviews published during the selected month.</p></div><label class="cr-rec-month">MONTH<input id="reviewMonth" type="month" value="'+monthValue(month)+'"></label></div><div id="reviewLeaderboard">'+leaderHtml+'</div></section><section class="cr-rec-section"><div class="cr-rec-section-head"><div><span class="cr-rec-kicker">LISTENER STORIES</span><h2>Featured listener reviews</h2><p>Thoughtful words from the community, selected by CrowRules moderators.</p></div></div><div class="cr-rec-feature-grid">'+featuredHtml+'</div></section><section class="cr-rec-section"><div class="cr-rec-section-head"><div><span class="cr-rec-kicker">EARNED THROUGH PARTICIPATION</span><h2>Reviewer achievements</h2><p>Recognition is earned automatically as members contribute and help others.</p></div></div><div class="cr-rec-badge-grid">'+(badgeResult.data||[]).map(b=>'<article class="cr-rec-badge"><span>'+esc(b.icon||"🏅")+'</span><div><b>'+esc(b.name)+'</b><p>'+esc(b.description)+'</p></div></article>').join("")+'</div></section><section class="cr-rec-section"><div class="cr-rec-section-head"><div><span class="cr-rec-kicker">RECENT COMMUNITY MILESTONES</span><h2>Recently recognized</h2></div></div><div class="cr-rec-awards">'+((awardResult.data||[]).filter(x=>people.has(x.user_id)&&badgeMap.has(x.badge_key)).map(x=>'<article>'+person(people.get(x.user_id))+'<span class="cr-rec-award-chip">'+esc(badgeMap.get(x.badge_key).icon||"🏅")+' '+esc(badgeMap.get(x.badge_key).name)+'</span><small>'+new Date(x.awarded_at).toLocaleDateString()+'</small></article>').join("")||'<div class="cr-rec-empty">New achievements will be celebrated here as members earn them.</div>')+'</div></section><footer class="cr-rec-footer"><a href="'+SITE_BASE+'profiles.html">Browse community profiles</a><span>ONE COMPANY. ONE UNIVERSE.</span></footer></div>';
  root.querySelector("#reviewMonth").addEventListener("change",async e=>{if(!e.target.value)return;const[year,monthNum]=e.target.value.split("-").map(Number);const selected=new Date(year,monthNum-1,1);const target=root.querySelector("#reviewLeaderboard");target.innerHTML='<div class="cr-rec-loading">Updating the leaderboard…</div>';try{target.innerHTML=await renderLeaderboard(selected)}catch(error){target.innerHTML='<div class="cr-rec-empty">'+esc(error.message)+'</div>'}});
 }catch(error){root.innerHTML='<section class="container section"><div class="notice">Reviewer recognition could not load: '+esc(error.message)+'</div><p><a href="'+SITE_BASE+'profiles.html">Back to the community</a></p></section>'}
}
init();
