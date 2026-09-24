import {SUPABASE_URL,SUPABASE_ANON_KEY,STRIPE_PUBLISHABLE_KEY,getSupabase,isConfigured} from "./supabase.js";

const state={
 points:0,
 shows:[],
 episodes:[],
 playing:false,
 current:null,
 queue:[],
 queueIndex:0,
 progress:0,
 duration:0,
 user:null,
 supabase:null
};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const toast=msg=>{let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.append(t)}t.textContent=msg;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),2200)};
const addPoints=n=>{state.points+=n;localStorage.setItem("cr_points",state.points);document.querySelectorAll(".points-pill b,#points").forEach(x=>x.textContent=state.points)};

function nav(){
 const el=document.querySelector("[data-nav]"); if(!el)return;
 el.innerHTML='<header class="nav"><a class="wordmark" href="home.html">CROWRULES<span>/ PODCASTING</span></a><nav><a href="home.html">Home</a><a href="discover.html">Discover</a><a href="charts.html">Charts</a><a href="live.html">Live</a><a href="schedule.html">Schedule</a><a href="library.html">Library</a><a href="studio.html">Studio</a></nav><div class="nav-actions"><a href="notifications.html" class="points-pill" aria-label="Notifications">◌</a><a href="crowpoints.html" class="points-pill" aria-label="CrowPoints">◉ <b>'+state.points+'</b></a><a href="account.html" class="avatar" id="accountAvatar">CR</a></div></header><div class="network-bar"><a href="search.html">⌕ Search</a><a href="creators.html">Creators</a><a href="subscriptions.html">Subscriptions</a><a href="subscribers.html">Subscribers</a><a href="earnings.html">Earnings</a><a href="payouts.html">Payouts</a><a href="help.html">Help</a></div>';
 window.addEventListener("scroll",()=>document.querySelector(".nav")?.classList.toggle("scrolled",scrollY>12),{passive:true});
}

function player(){
 if(document.querySelector(".player"))return;
 document.body.insertAdjacentHTML("beforeend",'<div class="player" id="player"><img class="player-art" id="playerArt" alt=""><div class="player-info"><b id="playerTitle">Nothing playing</b><span id="playerMeta">CrowRules Podcasting</span></div><div class="player-controls"><button data-prev aria-label="Previous">↶</button><button class="main" data-toggle aria-label="Play">▶</button><button data-next aria-label="Next">↷</button></div><div class="player-progress"><i id="playerProgress"></i></div><audio id="crAudio" preload="metadata"></audio></div>');
 const a=document.getElementById("crAudio");
 a.addEventListener("timeupdate",()=>{if(!a.duration)return;state.progress=(a.currentTime/a.duration)*100;document.getElementById("playerProgress").style.width=state.progress+"%";});
 a.addEventListener("loadedmetadata",()=>state.duration=a.duration);
 a.addEventListener("ended",()=>{addPoints(10);toast("+10 CrowPoints • episode completed");playNext()});
}

function card(s){
 return '<article class="show-card" data-genre="'+esc(s.genre)+'"><a href="podcast.html?show='+encodeURIComponent(s.slug||s.id)+'"><img src="'+esc(s.art)+'" alt="'+esc(s.title)+' artwork" loading="lazy" onerror="this.style.display=\'none\'"><div class="card-copy"><span class="badge">'+esc(s.genre)+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.tag||s.description||"")+'</p><small>'+Number(s.episodes||0)+' episodes • '+esc(s.host||"CrowRules Creator")+'</small></div></a><div class="card-tools"><button data-follow>Follow</button><button data-share>Share</button><button data-save>☆</button></div></article>';
}

async function loadData(){
 if(!isConfigured){state.shows=[];return}
 try{
  state.supabase=await getSupabase();
  const {data,error}=await state.supabase.from("podcasts").select("id,title,slug,category,description,artwork_url,status,is_featured,is_live,listener_count,total_plays,creator_id,creators(name)").eq("status","published").order("is_featured",{ascending:false}).order("created_at",{ascending:false});
  if(error)throw error;
  const rows=data||[];
  if(rows.length){
   const ep=await state.supabase.from("podcast_episodes").select("id,podcast_id,title,slug,description,episode_number,season_number,published_at,duration_seconds,audio_url,video_url,thumbnail_url,transcript,show_notes,status,play_count,access_level").eq("status","published").order("published_at",{ascending:false});
   if(ep.error)throw ep.error;
   state.episodes=ep.data||[];
   state.shows=rows.map(p=>{const es=state.episodes.filter(e=>e.podcast_id===p.id);return {id:p.id,dbId:p.id,slug:p.slug,title:p.title,host:p.creators?.name||"CrowRules Creator",genre:(p.category||"Podcast").toLowerCase(),tag:p.description||"CrowRules Podcasting transmission",description:p.description,art:p.artwork_url||"",episodes:es.length,subscribers:0,plays:Number(p.total_plays||0),listener_count:Number(p.listener_count||0),live:Boolean(p.is_live),episodeRows:es}};
  });
  }
 }catch(err){console.warn("Podcasting database load failed:",err);state.shows=[];state.episodes=[];toast("Live catalog unavailable • check the database connection")}
}

async function loadAuth(){
 if(!state.supabase)return;
 const {data}=await state.supabase.auth.getUser();
 state.user=data?.user||null;
 await refreshPoints();
 const avatar=document.getElementById("accountAvatar");
 if(avatar)avatar.textContent=state.user?(state.user.user_metadata?.name||state.user.email||"CR").slice(0,2).toUpperCase():"CR";
}

async function refreshPoints(){
 if(!state.supabase||!state.user)return;
 const {data}=await state.supabase.from("podcast_creator_stats").select("crowpoints").eq("user_id",state.user.id).maybeSingle();
 if(data?.crowpoints!=null){state.points=Number(data.crowpoints);localStorage.setItem("cr_points",state.points);document.querySelectorAll(".points-pill b,#points").forEach(x=>x.textContent=state.points);}
}
async function renderRails(){
 document.querySelectorAll("[data-show-rail]").forEach(el=>el.innerHTML=state.shows.slice(0,8).map(card).join(""));
 const rail=document.querySelector('[data-show-rail="subscriptions"]');
 if(rail&&state.supabase&&state.user){
  const {data}=await state.supabase.from("podcast_subscriptions").select("podcast_id,status").eq("user_id",state.user.id).in("status",["active","trialing","past_due"]);
  const ids=new Set((data||[]).map(x=>x.podcast_id));const mine=state.shows.filter(s=>ids.has(s.dbId));
  rail.innerHTML=mine.length?mine.map(card).join(""):'<div class="panel empty"><h2>No active paid shows.</h2><p>Your free follows remain available in your Library.</p><a class="btn primary" href="discover.html">Discover shows</a></div>';
 }else if(rail){rail.innerHTML='<div class="panel empty"><h2>Sign in to view subscriptions.</h2><a class="btn primary" href="account.html">Open account</a></div>'}
}
async function loadLibrary(){
 const el=document.getElementById("libraryPage");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Your library starts with your account.</h2><p>Sign in to see saved episodes, followed shows and continue listening.</p><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const [saved,followed,progress]=await Promise.all([
  state.supabase.from("podcast_saved_episodes").select("episode_id").eq("user_id",state.user.id),
  state.supabase.from("podcast_follows").select("podcast_id").eq("user_id",state.user.id),
  state.supabase.from("podcast_episode_progress").select("episode_id,position_seconds,duration_seconds,percent_complete,last_played_at").eq("user_id",state.user.id).order("last_played_at",{ascending:false}).limit(12)
 ]);
 const savedIds=new Set((saved.data||[]).map(x=>x.episode_id)),followIds=new Set((followed.data||[]).map(x=>x.podcast_id));
 const savedEpisodes=state.episodes.filter(e=>savedIds.has(e.id)),followShows=state.shows.filter(s=>followIds.has(s.dbId)),continueRows=(progress.data||[]).map(p=>({...p,episode:state.episodes.find(e=>e.id===p.episode_id)})).filter(x=>x.episode);
 const epCard=e=>'<article class="episode"><button class="play" data-episode-id="'+esc(e.id)+'">▶</button><div><h3>'+esc(e.title)+'</h3><p>'+esc(state.shows.find(s=>s.dbId===e.podcast_id)?.title||"Podcast")+'</p></div><button data-save>★ Saved</button></article>';
 el.innerHTML='<section class="section"><div class="section-head"><div><p class="eyebrow">CONTINUE LISTENING</p><h2>Pick up where you left off.</h2></div></div><div class="episode-list">'+(continueRows.length?continueRows.map(x=>'<article class="episode"><button class="play" data-episode-id="'+esc(x.episode.id)+'">▶</button><div><h3>'+esc(x.episode.title)+'</h3><p>'+Math.round(Number(x.percent_complete||0))+'% complete</p></div></article>').join(""):'<div class="panel empty"><p>No listening history yet.</p></div>')+'</div></section><section class="section"><div class="section-head"><div><p class="eyebrow">FOLLOWING</p><h2>Your shows.</h2></div></div><div class="card-grid">'+(followShows.length?followShows.map(card).join(""):'<div class="panel empty"><p>You are not following any shows yet.</p></div>')+'</div></section><section class="section"><div class="section-head"><div><p class="eyebrow">SAVED</p><h2>Episodes for later.</h2></div></div><div class="episode-list">'+(savedEpisodes.length?savedEpisodes.map(epCard).join(""):'<div class="panel empty"><p>No saved episodes yet.</p></div>')+'</div></section>';
}

function discover(){
 const grid=document.getElementById("discoverGrid");if(!grid)return;
 const render=a=>grid.innerHTML=a.length?a.map(card).join(""):'<div class="panel empty"><h2>No transmissions found.</h2><p>Try another search or category.</p></div>';
 render(state.shows);
 document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");render(b.dataset.filter==="all"?state.shows:state.shows.filter(s=>s.genre===b.dataset.filter))});
 document.querySelector("[data-search]")?.addEventListener("click",()=>{const q=(document.getElementById("discoverSearch")?.value||"").toLowerCase();render(state.shows.filter(s=>(s.title+" "+s.host+" "+s.tag+" "+s.genre).toLowerCase().includes(q)))});
}

function showPage(){
 const el=document.getElementById("showPage");if(!el)return;
 const key=new URLSearchParams(location.search).get("show");
 const s=state.shows.find(x=>String(x.slug||x.id)===String(key))||state.shows[0];
 if(!s){el.innerHTML='<div class="panel"><h2>Podcast not found.</h2></div>';return}
 const eps=s.episodeRows||[];
 const episodeMarkup=eps.length?eps.slice(0,12).map(e=>'<article class="episode"><button class="play" data-episode-id="'+esc(e.id)+'">▶</button><div><span>EPISODE '+String(e.episode_number||"").padStart(2,"0")+(e===eps[0]?' • NEW':'')+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||e.show_notes||"New transmission.")+'</p></div><button data-save>☆ Save</button></article>').join(""):'<div class="panel empty"><h2>No published episodes yet.</h2><p>The show is ready for its next transmission.</p></div>';
 el.innerHTML='<section class="show-hero" style="--art:url(\''+esc(s.art)+'\')"><div class="show-hero-copy"><span class="badge">'+esc(s.genre)+'</span><h1>'+esc(s.title)+'</h1><p class="lead">'+esc(s.description||s.tag)+'. Follow the show for new transmissions, save episodes and join the conversation.</p><div class="actions"><button class="btn primary" data-play-show="'+esc(s.id)+'">▶ Play latest</button><button class="btn" data-follow>＋ Follow</button><button class="btn" data-share>Share</button><button class="btn" data-save>☆ Save show</button><a class="btn" href="subscriptions.html?show='+encodeURIComponent(s.slug||s.id)+'">Subscribe</a></div><div class="profile-stats"><span><b>'+Number(s.episodes||0)+'</b>episodes</span><span><b>'+Number(s.subscribers||0)+'</b>subscribers</span><span><b>'+esc(s.host)+'</b>host</span></div></div></section><section class="section"><div class="section-head"><div><p class="eyebrow">EPISODES</p><h2>Latest transmissions</h2></div><a href="schedule.html">Schedule →</a></div><div class="episode-list">'+episodeMarkup+'</div></section><section class="section feature-strip"><div class="feature-tile"><p class="eyebrow">COMMUNITY</p><h2>Live conversation.</h2><p>Join listeners around the show in real time.</p><a class="btn primary" href="chat.html?room='+encodeURIComponent(s.slug||s.id)+'">Enter room</a></div><div class="feature-tile"><p class="eyebrow">PREMIUM</p><h2>Go deeper.</h2><p>Support the creator with a paid subscription.</p><a class="btn" href="subscriptions.html?show='+encodeURIComponent(s.slug||s.id)+'">View tiers</a></div><div class="feature-tile"><p class="eyebrow">CREATOR</p><h2>'+esc(s.host)+'</h2><p>Explore the creator profile and other shows.</p><a class="btn" href="creator.html?host='+encodeURIComponent(s.host)+'">View creator</a></div></section>';
}

function charts(){
 const el=document.getElementById("charts");if(!el)return;
 const rows=state.shows.slice().sort((a,b)=>(b.plays||0)-(a.plays||0)).map((s,i)=>'<div class="rank"><strong>#'+(i+1)+'</strong><img src="'+esc(s.art)+'" alt="" loading="lazy"><div><h3>'+esc(s.title)+'</h3><p>'+esc(s.host)+' • '+Number(s.episodes||0)+' episodes</p></div><span>'+Number(s.plays||0).toLocaleString()+' plays</span></div>').join("");
 el.innerHTML=rows||'<div class="panel empty"><h2>Charts are warming up.</h2></div>';
}

async function followPodcast(id,button){return followReal(id,button)}

async function playEpisode(e){
 player();
 const a=document.getElementById("crAudio");
 let ep=state.episodes.find(x=>x.id===e.id)||e;
 if(!ep.audio_url){toast("This episode does not have an audio file yet");return}
 state.current=ep;document.getElementById("playerTitle").textContent=ep.title;document.getElementById("playerMeta").textContent="CrowRules Podcasting • Now playing";
 const art=state.shows.find(s=>s.dbId===ep.podcast_id)?.art; if(art)document.getElementById("playerArt").src=art;
 if(a.src!==ep.audio_url)a.src=ep.audio_url;
 a.currentTime=0;try{await a.play();state.playing=true;document.getElementById("player").classList.add("show");document.querySelector("[data-toggle]").textContent="Ⅱ";}catch{toast("Press play to start this transmission")}
 if(state.supabase&&state.user){state.supabase.from("podcast_listens").insert({user_id:state.user.id,episode_id:ep.id,seconds_listened:0,completed:false,session_key:crypto.randomUUID?.()||String(Date.now())}).then(()=>{});}
}

function playNext(){if(!state.queue.length)return;state.queueIndex=(state.queueIndex+1)%state.queue.length;playEpisode(state.queue[state.queueIndex]);}

function startShow(id){
 const s=state.shows.find(x=>x.id===id||x.dbId===id);if(!s)return;
 const eps=s.episodeRows||state.episodes.filter(e=>e.podcast_id===s.dbId);
 if(eps.length){state.queue=eps;state.queueIndex=0;playEpisode(eps[0]);}
 else toast("The show is ready for audio uploads");
}

async function chat(){
 const f=document.getElementById("chatForm");if(!f)return;
 if(!state.supabase){document.getElementById("messages").innerHTML='<div class="panel empty"><p>Live chat requires the database connection.</p></div>';return}
 const slug=new URLSearchParams(location.search).get("room")||"community";
 const {data:room,error:roomError}=await state.supabase.from("podcast_chat_rooms").select("id,name,slug,is_live").eq("slug",slug).maybeSingle();
 if(roomError||!room){document.getElementById("messages").innerHTML='<div class="panel empty"><p>This live room has not been provisioned yet.</p></div>';return}
 document.getElementById("roomTitle").textContent=room.name;
 const render=rows=>document.getElementById("messages").innerHTML=(rows||[]).map(m=>'<div><b>'+esc(m.display_name)+'</b><span>'+esc(m.message)+'</span></div>').join("")||'<div class="panel empty"><p>No messages yet.</p></div>';
 const {data:messages}=await state.supabase.from("podcast_chat_messages").select("id,display_name,message,created_at").eq("room_id",room.id).eq("is_hidden",false).order("created_at",{ascending:true}).limit(100);
 render(messages);
 state.supabase.channel("podcast-chat-"+room.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"podcast_chat_messages",filter:"room_id=eq."+room.id},payload=>{if(payload.new&&!payload.new.is_hidden)document.getElementById("messages").insertAdjacentHTML("beforeend",'<div><b>'+esc(payload.new.display_name)+'</b><span>'+esc(payload.new.message)+'</span></div>')}).subscribe();
 f.onsubmit=async e=>{e.preventDefault();if(!state.user){toast("Sign in to chat");return}const input=document.getElementById("chatInput"),textValue=input.value.trim();if(!textValue)return;const displayName=state.user.user_metadata?.name||state.user.email?.split("@")[0]||"Member";const {error}=await state.supabase.from("podcast_chat_messages").insert({room_id:room.id,user_id:state.user.id,display_name:displayName,message:textValue});if(error){toast(error.message);return}input.value="";addPoints(2);toast("+2 CrowPoints • message sent")};
}

async function forms(){
 document.querySelectorAll("[data-demo-form]").forEach(f=>f.onsubmit=async e=>{
  e.preventDefault();
  if(f.matches('[data-demo-form]')&&f.closest("main")?.querySelector("h1")?.textContent.includes("Create a podcast")){
   if(!state.supabase||!state.user){toast("Sign in before creating a podcast");return}
   const fd=new FormData(f);
   const title=String(fd.get("name")||"").trim();
   const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
   const {data:member}=await state.supabase.from("members").select("id").eq("user_id",state.user.id).maybeSingle();
   const {data:creator}=member?await state.supabase.from("creators").select("id").eq("member_id",member.id).maybeSingle():{data:null};
   const {data:newPodcast,error}=await state.supabase.from("podcasts").insert({title,slug,description:fd.get("description")||"",category:fd.get("genre")||"Podcast",artwork_url:fd.get("artwork_url")||null,status:"draft",creator_id:creator?.id||null}).select("id").single();
   if(error){toast("Could not create podcast: "+error.message);return}
   const {error:mapError}=await state.supabase.from("podcast_creators").insert({podcast_id:newPodcast.id,user_id:state.user.id,role:"owner",can_manage:true});
   if(mapError){await state.supabase.from("podcasts").delete().eq("id",newPodcast.id);toast("Could not create creator ownership: "+mapError.message);return}
   toast("Podcast draft created in Supabase");
  }else if(f.closest("main")?.querySelector("h1")?.textContent.includes("Add an episode.")){
   if(!state.supabase||!state.user){toast("Sign in before publishing an episode");return}
   const fd=new FormData(f),podcastTitle=String(fd.get("podcast")||""),podcast=state.shows.find(s=>s.title===podcastTitle);
   if(!podcast?.dbId){toast("Choose a database podcast");return}
   const {data:owner}=await state.supabase.from("podcast_creators").select("id").eq("user_id",state.user.id).eq("podcast_id",podcast.dbId).eq("can_manage",true).maybeSingle();
   if(!owner){toast("You do not have publishing access to this show");return}
   const {error}=await state.supabase.from("podcast_episodes").insert({podcast_id:podcast.dbId,title:String(fd.get("title")||""),audio_url:String(fd.get("audio_url")||""),show_notes:String(fd.get("notes")||""),access_level:fd.get("premium")?"premium":"free",status:"draft"});
   if(error){toast("Could not create episode: "+error.message);return}
   toast("Episode draft created • ready for publishing");
  }else toast("Draft saved");
 });
 document.querySelectorAll("[data-login]").forEach(b=>b.onclick=async()=>{if(!state.supabase){toast("Add public Supabase config to enable Google Auth");return}const {error}=await state.supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href}});if(error)toast(error.message)});
 document.querySelectorAll("[data-stripe]").forEach(b=>b.onclick=()=>toast(STRIPE_PUBLISHABLE_KEY?"Stripe publishable key detected • server Checkout/Connect flow required":"Add Stripe publishable configuration before connecting payments"));
}

function actions(){
 document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-like],[data-follow],[data-save],[data-share],[data-play-show],[data-episode-id],[data-toggle],[data-next],[data-prev]");
  if(!b)return;
  if(b.dataset.share!==undefined){try{await navigator.clipboard?.writeText(location.href);toast("Link copied")}catch{toast(location.href)}addPoints(3)}
  else if(b.dataset.like!==undefined){b.textContent=b.textContent==="♡"?"♥":"♡";if(b.textContent==="♥"){addPoints(2);toast("+2 CrowPoints")}}
  else if(b.dataset.follow!==undefined){const showId=document.querySelector("[data-play-show]")?.dataset.playShow;await followPodcast(showId,b)}
  else if(b.dataset.save!==undefined){
  const episodeId=b.dataset.episodeId||b.closest(".episode")?.querySelector("[data-episode-id]")?.dataset.episodeId;
  if(episodeId) await saveEpisodeReal(episodeId,b);
  else {b.textContent=b.textContent.includes("Save")||b.textContent==="☆"?"★ Saved":"☆ Save";if(b.textContent.includes("Saved")){addPoints(4);toast("+4 CrowPoints • saved")}}
}
  else if(b.dataset.playShow!==undefined)startShow(b.dataset.playShow);
  else if(b.dataset.episodeId!==undefined){const ep=state.episodes.find(x=>x.id===b.dataset.episodeId);if(ep)playEpisode(ep)}
  else if(b.dataset.toggle!==undefined){const a=document.getElementById("crAudio");if(!a.src){toast("Choose an episode first");return}if(a.paused){await a.play();state.playing=true;b.textContent="Ⅱ"}else{a.pause();state.playing=false;b.textContent="▶"}}
  else if(b.dataset.next!==undefined)playNext();
  else if(b.dataset.prev!==undefined){if(state.queue.length){state.queueIndex=(state.queueIndex-1+state.queue.length)%state.queue.length;playEpisode(state.queue[state.queueIndex])}}
 });
}

function creators(){
 const el=document.getElementById("creators");if(!el)return;
 const hosts=[...new Map(state.shows.map(s=>[s.host,s])).values()];
 el.innerHTML=hosts.map(s=>'<a class="panel" href="creator.html?host='+encodeURIComponent(s.host)+'"><img class="profile-art" src="'+esc(s.art)+'" alt=""><p class="eyebrow">CREATOR</p><h2>'+esc(s.host)+'</h2><p>Podcast creator • '+state.shows.filter(x=>x.host===s.host).length+' shows</p></a>').join("");
}
function creator(){
 const el=document.getElementById("creatorPage");if(!el)return;
 const host=new URLSearchParams(location.search).get("host")||state.shows[0]?.host,shows=state.shows.filter(s=>s.host===host),s=shows[0]||state.shows[0];
 if(!s)return;el.innerHTML='<section class="profile-head"><img class="profile-art" src="'+esc(s.art)+'" alt=""><div><p class="eyebrow">CREATOR PROFILE</p><h1>'+esc(host)+'</h1><p>Creator profile in the CrowRules Podcasting network.</p><div class="actions"><button class="btn primary" data-follow>＋ Follow creator</button><button class="btn" data-share>Share profile</button></div></div></section><section class="section"><div class="section-head"><div><p class="eyebrow">SHOWS</p><h2>From this creator</h2></div></div><div class="card-grid">'+shows.map(card).join("")+'</div></section>';
}
async function schedule(){const el=document.getElementById("schedule");if(!el)return;if(!state.supabase){el.innerHTML='<div class="panel empty"><p>Live schedule requires the database connection.</p></div>';return}
 const {data,error}=await state.supabase.from("podcast_schedule").select("id,podcast_id,episode_id,title,starts_at,ends_at,timezone,status").eq("status","scheduled").gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(30);
 if(error){el.innerHTML='<div class="panel empty"><p>'+esc(error.message)+'</p></div>';return}
 el.innerHTML=(data||[]).map(x=>{const s=state.shows.find(v=>v.dbId===x.podcast_id);const href=s?'podcast.html?show='+encodeURIComponent(s.slug||s.id):'#';return '<div class="slot"><time>'+new Date(x.starts_at).toLocaleString()+'</time><div><h3>'+esc(x.title||s?.title||"Scheduled transmission")+'</h3><p>'+esc(s?.host||"CrowRules Creator")+'</p></div><a class="btn" href="'+href+'">Open</a></div>'}).join("")||'<div class="panel empty"><p>No scheduled transmissions.</p></div>'}


async function saveEpisodeReal(episodeId,button){
 if(!state.supabase||!state.user){toast("Sign in to save episodes");return}
 const {data:existing}=await state.supabase.from("podcast_saved_episodes").select("id").eq("user_id",state.user.id).eq("episode_id",episodeId).maybeSingle();
 if(existing){
  await state.supabase.from("podcast_saved_episodes").delete().eq("id",existing.id);
  if(button)button.textContent="☆ Save";
  toast("Removed from Saved");
 }else{
  const {error}=await state.supabase.from("podcast_saved_episodes").insert({user_id:state.user.id,episode_id:episodeId});
  if(error){toast("Could not save episode");return}
  if(button)button.textContent="★ Saved";
  addPoints(4);toast("+4 CrowPoints • episode saved");
 }
}

async function followReal(podcastId,button){
 if(!state.supabase||!state.user){toast("Sign in to follow");return}
 const {data:existing}=await state.supabase.from("podcast_follows").select("id").eq("user_id",state.user.id).eq("podcast_id",podcastId).maybeSingle();
 if(existing){
  await state.supabase.from("podcast_follows").delete().eq("id",existing.id);
  if(button)button.textContent="＋ Follow";
  toast("Unfollowed");
 }else{
  const {error}=await state.supabase.from("podcast_follows").insert({user_id:state.user.id,podcast_id:podcastId});
  if(error){toast("Could not follow");return}
  if(button)button.textContent="Following";
  addPoints(5);toast("+5 CrowPoints • following");
 }
}

let progressTimer=null;
async function persistProgress(){
 const a=document.getElementById("crAudio"),ep=state.current;
 if(!a||!ep||!state.supabase||!state.user||!Number.isFinite(a.currentTime))return;
 const duration=Math.round(a.duration||state.duration||0),position=Math.round(a.currentTime||0);
 if(!duration)return;
 const percent=Math.min(100,Math.round((position/duration)*10000)/100);
 await state.supabase.from("podcast_episode_progress").upsert({
  user_id:state.user.id,episode_id:ep.id,position_seconds:position,duration_seconds:duration,
  percent_complete:percent,completed:percent>=95,last_played_at:new Date().toISOString(),updated_at:new Date().toISOString()
 },{onConflict:"user_id,episode_id"});
}

function wireProgress(){
 const a=document.getElementById("crAudio");if(!a||a._crProgress)return;
 a._crProgress=true;
 a.addEventListener("timeupdate",()=>{clearTimeout(progressTimer);progressTimer=setTimeout(persistProgress,1500)});
 a.addEventListener("pause",persistProgress);
 a.addEventListener("ended",persistProgress);
}

async function subscribeToProduct(productId){
 if(!state.supabase||!state.user){toast("Sign in before subscribing");return}
 try{
  const {data,error}=await state.supabase.functions.invoke("create-podcast-checkout",{
   body:{product_id:productId,origin:location.origin+location.pathname.replace(/[^/]*$/,""),success_url:location.origin+location.pathname+"?checkout=success",cancel_url:location.href}
  });
  if(error)throw error;
  if(!data?.url)throw new Error(data?.error||"Checkout URL missing");
  location.href=data.url;
 }catch(e){toast(e.message||"Unable to start Stripe Checkout")}
}

async function loadSubscriptionPage(){
 const el=document.getElementById("subscriptionsPage");if(!el||!state.supabase)return;
 if(!state.user){el.innerHTML='<div class="panel empty"><h2>Sign in to subscribe.</h2><a class="btn primary" href="account.html">Sign in with Google</a></div>';return}
 const showKey=new URLSearchParams(location.search).get("show");
 let q=state.supabase.from("cr_podcast_monetization_products").select("id,name,description,amount_cents,interval,podcast_id,grants_premium_access,stripe_price_id").eq("product_type","membership").eq("active",true);
 if(showKey){const show=state.shows.find(s=>String(s.slug||s.id)===showKey);if(show?.dbId)q=q.eq("podcast_id",show.dbId)}
 const {data,error}=await q.order("amount_cents",{ascending:true});
 if(error){el.innerHTML='<div class="panel empty"><h2>Subscription catalog unavailable.</h2><p>'+esc(error.message)+'</p></div>';return}
 const rows=data||[];
 el.innerHTML=rows.length?rows.map(p=>'<article class="price-card '+(Number(p.amount_cents)>=700?'featured':'')+'"><p class="eyebrow">MEMBERSHIP</p><h2>$'+(Number(p.amount_cents)/100).toFixed(2)+'<span>/'+esc(p.interval||"month")+'</span></h2><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"Premium access to a CrowRules podcast.")+'</p><button class="btn primary" data-subscribe-product="'+esc(p.id)+'">Subscribe with Stripe</button></article>').join(""):'<div class="panel empty"><h2>No paid podcast tiers yet.</h2><p>Creators can create a real Stripe-backed membership from Monetization.</p><a class="btn primary" href="monetization.html">Open monetization</a></div>';
}

async function loadCreatorDashboard(){
 const el=document.getElementById("creatorDashboard");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Sign in to open Creator Studio.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const [stats,products,mon]=await Promise.all([
  state.supabase.from("podcast_creator_stats").select("*").eq("user_id",state.user.id).maybeSingle(),
  state.supabase.from("cr_podcast_monetization_products").select("id,name,amount_cents,interval,podcast_id,active").eq("active",true),
  state.supabase.from("creator_monetization").select("status,payouts_enabled,charges_enabled,stripe_account_id").eq("user_id",state.user.id).maybeSingle()
 ]);
 const s=stats.data||{};
 el.innerHTML='<div class="panel"><p class="eyebrow">AUDIENCE</p><h2>Network snapshot</h2><div class="stats"><span><b>'+Number(s.podcast_count||0)+'</b> shows</span><span><b>'+Number(s.published_episode_count||0)+'</b> published</span><span><b>'+Number(s.total_plays||0).toLocaleString()+'</b> plays</span><span><b>'+Number(s.follower_count||0).toLocaleString()+'</b> followers</span></div></div><div class="panel"><p class="eyebrow">MEMBERS</p><h2>Paid subscribers</h2><p class="metric">'+(mon.data?.status==="active"?"Connected":"Not connected")+'</p><a class="btn" href="subscribers.html">View subscribers</a></div><div class="panel"><p class="eyebrow">EARNINGS</p><h2>Revenue ledger</h2><p class="metric">$'+(Number(s.total_plays||0)*0).toFixed(2)+'</p><a class="btn" href="earnings.html">Open earnings</a></div><div class="panel"><p class="eyebrow">PAYOUTS</p><h2>'+(mon.data?.payouts_enabled?"Payouts enabled":"Connect Stripe")+'</h2><a class="btn primary" href="payouts.html">'+(mon.data?.payouts_enabled?"Manage payouts":"Connect creator account")+'</a></div>';
}

async function loadPayoutsPage(){
 const el=document.getElementById("payoutsPage");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<h2>Sign in required.</h2><a class="btn primary" href="account.html">Sign in</a>';return}
 const {data,error}=await state.supabase.functions.invoke("creator-connect-status",{body:{}});
 if(error||data?.error){el.innerHTML='<h2>Stripe status unavailable.</h2><p>'+esc(data?.error||error?.message||"Try again.")+'</p><button class="btn primary" data-connect-stripe>Connect Stripe</button>';return}
 const states=[["not_connected","Not Connected"],["setup_started","Setup Started"],["action_required","Action Required"],["payouts_enabled","Payouts Enabled"]];
 el.innerHTML='<p class="eyebrow">LIVE STRIPE STATE</p><h2>'+esc(data.label)+'</h2><p>'+esc(data.detail)+'</p><div class="status-list">'+states.map(x=>'<span>'+x[1]+' <b>'+(x[0]===data.state?"CURRENT":"")+'</b></span>').join("")+'</div><div class="actions"><button class="btn primary" data-connect-stripe>'+(data.state==="not_connected"?"Connect Account":"Continue Setup")+'</button><a class="btn" href="studio.html">Back to Studio</a></div>';
}

async function connectStripe(){
 if(!state.supabase||!state.user){toast("Sign in before connecting Stripe");return}
 const {data,error}=await state.supabase.functions.invoke("creator-connect-onboarding",{body:{}});
 if(error||data?.error){toast(data?.error||error?.message||"Stripe onboarding failed");return}
 if(data?.onboarding_url)location.href=data.onboarding_url;
}

async function loadSubscribersPage(){
 const el=document.getElementById("subscribersPage");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Sign in required.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const {data:creatorRows}=await state.supabase.from("podcast_creators").select("podcast_id").eq("user_id",state.user.id);
 const ids=(creatorRows||[]).map(x=>x.podcast_id);
 if(!ids.length){el.innerHTML='<div class="panel empty"><h2>No creator shows yet.</h2><a class="btn primary" href="create-podcast.html">Create podcast</a></div>';return}
 const {data}=await state.supabase.from("podcast_subscriptions").select("podcast_id,status,started_at,current_period_end,cancel_at_period_end").in("podcast_id",ids).order("started_at",{ascending:false});
 el.innerHTML='<div class="table-like">'+((data||[]).map(x=>'<div class="slot"><div><h3>'+esc(state.shows.find(s=>s.dbId===x.podcast_id)?.title||"Podcast")+'</h3><p>'+esc(x.status)+' • '+(x.current_period_end?new Date(x.current_period_end).toLocaleDateString():"")+'</p></div><span>'+(x.cancel_at_period_end?"Ending":"Active")+'</span></div>').join("")||'<div class="panel empty"><p>No paid subscribers yet.</p></div>')+'</div>';
}

async function loadEarningsPage(){
 const el=document.getElementById("earningsPage");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Sign in required.</h2></div>';return}
 const {data,error}=await state.supabase.from("cr_creator_revenue_transactions").select("gross_amount,platform_fee,creator_amount,stripe_fee,currency,status,description,occurred_at,podcast_title").eq("user_id",state.user.id).order("occurred_at",{ascending:false}).limit(100);
 if(error){el.innerHTML='<div class="panel empty"><p>'+esc(error.message)+'</p></div>';return}
 const rows=data||[],gross=rows.reduce((a,x)=>a+Number(x.gross_amount||0),0),net=rows.reduce((a,x)=>a+Number(x.creator_amount||0),0);
 el.innerHTML='<div class="panel"><p class="eyebrow">GROSS</p><h2>$'+(gross/100).toFixed(2)+'</h2><p>Verified Stripe revenue</p></div><div class="panel"><p class="eyebrow">CREATOR SHARE</p><h2>$'+(net/100).toFixed(2)+'</h2><p>After recorded platform fees</p></div><div class="panel"><p class="eyebrow">TRANSACTIONS</p><h2>'+rows.length+'</h2><p>Webhook-backed ledger entries</p></div><div class="panel"><p class="eyebrow">LATEST</p><div class="table-like">'+rows.slice(0,10).map(x=>'<div class="slot"><div><h3>'+esc(x.description||x.podcast_title||"Revenue")+'</h3><p>'+new Date(x.occurred_at).toLocaleString()+'</p></div><strong>$'+(Number(x.creator_amount||0)/100).toFixed(2)+'</strong></div>').join("")+'</div></div>';
}

async function loadMonetizationPage(){
 const el=document.getElementById("monetizationPage");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Sign in to monetize a show.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const {data:products}=await state.supabase.from("cr_podcast_monetization_products").select("id,name,amount_cents,interval,podcast_id,active,grants_premium_access").eq("active",true).order("created_at",{ascending:false});
 el.innerHTML='<div class="panel"><p class="eyebrow">STRIPE CONNECT</p><h2>Creator payout account</h2><p>Connect once; the live Stripe state is checked whenever you return.</p><a class="btn primary" href="payouts.html">Open payout onboarding</a></div><div class="panel"><p class="eyebrow">PRODUCTS</p><h2>Membership tiers</h2><div class="table-like">'+((products||[]).map(p=>'<div class="slot"><div><h3>'+esc(p.name)+'</h3><p>$'+(Number(p.amount_cents)/100).toFixed(2)+'/'+esc(p.interval||"one-time")+'</p></div><a class="btn" href="subscriptions.html?show='+encodeURIComponent(state.shows.find(s=>s.dbId===p.podcast_id)?.slug||"")+'">View checkout</a></div>').join("")||'<p>No membership products yet.</p>')+'</div></div><div class="panel"><p class="eyebrow">CREATE</p><h2>Create a paid membership</h2><form class="form" data-product-form><label>Podcast<select name="podcast_id">'+state.shows.map(s=>'<option value="'+esc(s.dbId)+'">'+esc(s.title)+'</option>').join("")+'</select></label><label>Name<input required name="name" value="Supporter Membership"></label><label>Monthly price<input required name="amount_cents" type="number" min="100" step="1" value="499"></label><label>Description<textarea name="description" rows="3">Bonus episodes and supporter access.</textarea></label><button class="btn primary">Create Stripe product + price</button></form></div>';
 const pf=document.querySelector("[data-product-form]");if(pf)pf.onsubmit=async e=>{e.preventDefault();const fd=new FormData(pf);const {data,error}=await state.supabase.functions.invoke("create-podcast-product",{body:{name:fd.get("name"),description:fd.get("description"),amount_cents:Number(fd.get("amount_cents")),interval:"month",product_type:"membership",podcast_id:fd.get("podcast_id")}});if(error||data?.error){toast(data?.error||error?.message||"Unable to create product");return}toast("Stripe product created");loadMonetizationPage()};
}

async function adminBootstrap(){
 if(!state.supabase||!state.user)return null;
 const {data,error}=await state.supabase.functions.invoke("podcasting-admin-bootstrap",{body:{}});
 return error?null:data;
}
async function loadAdminPage(){
 const el=document.getElementById("adminDashboard");if(!el)return;
 if(!state.supabase||!state.user){el.innerHTML='<div class="panel empty"><h2>Administrator sign-in required.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const admin=await adminBootstrap();
 if(!admin||admin.status==="pending"||admin.status==="disabled"){el.innerHTML='<div class="panel empty"><h2>Administrator access is not active.</h2><p>'+esc(admin?.message||admin?.error||"Your request has been recorded for review.")+'</p></div>';return}
 const [p,e,c]=await Promise.all([
  state.supabase.from("podcasts").select("id,status",{count:"exact",head:true}),
  state.supabase.from("podcast_episodes").select("id,status",{count:"exact",head:true}),
  state.supabase.from("podcast_chat_messages").select("id",{count:"exact",head:true}).eq("is_hidden",false)
 ]);
 el.innerHTML='<a class="panel" href="admin-shows.html"><p class="eyebrow">PUBLISHING</p><h2>Shows & episodes</h2><p>'+(p.count||0)+' shows • '+(e.count||0)+' episodes</p></a><a class="panel" href="admin-chat.html"><p class="eyebrow">MODERATION</p><h2>Chat</h2><p>'+(c.count||0)+' visible messages</p></a><a class="panel" href="subscribers.html"><p class="eyebrow">MEMBERS</p><h2>Subscribers</h2><p>Review creator subscriber relationships.</p></a><a class="panel" href="earnings.html"><p class="eyebrow">MONETIZATION</p><h2>Earnings</h2><p>Verified Stripe revenue ledger.</p></a>';
}

function wireOperatingSystem(){
 wireProgress();
 document.querySelectorAll("[data-subscribe-product]").forEach(b=>b.onclick=()=>subscribeToProduct(b.dataset.subscribeProduct));
 document.querySelectorAll("[data-connect-stripe]").forEach(b=>b.onclick=connectStripe);
 loadSubscriptionPage();loadCreatorDashboard();loadPayoutsPage();loadSubscribersPage();loadEarningsPage();loadMonetizationPage();loadAdminPage();
 document.querySelectorAll("[data-demo-form]").forEach(f=>f.addEventListener("submit",()=>setTimeout(()=>wireProgress(),50)));
}

async function boot(){
 nav();player();await loadData();await loadAuth();await renderRails();await loadLibrary();discover();showPage();charts();chat();forms();actions();creators();creator();schedule();wireOperatingSystem();
 if(state.supabase)state.supabase.auth.onAuthStateChange(async(_e,s)=>{state.user=s?.user||null;const a=document.getElementById("accountAvatar");if(a)a.textContent=state.user?(state.user.email||"CR").slice(0,2).toUpperCase():"CR";await renderRails();await loadLibrary();wireOperatingSystem()});
}
boot();
