import {SUPABASE_URL,SUPABASE_ANON_KEY,STRIPE_PUBLISHABLE_KEY,getSupabase,isConfigured} from "./supabase.js";

const FALLBACK_SHOWS=[
 {id:"bonded-in-mystery",title:"Bonded in Mystery",host:"CrowRules Originals",genre:"mystery",tag:"True mystery, strange stories",art:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85",episodes:12,subscribers:184,plays:0},
 {id:"tacoma-nights",title:"Tacoma Nights",host:"CrowRules",genre:"storytelling",tag:"Building CrowRules in real time",art:"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=85",episodes:25,subscribers:327,plays:0},
 {id:"bird-brains",title:"Bird Brains",host:"Crow + KingCrow",genre:"conversation",tag:"Unfiltered conversations",art:"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=85",episodes:42,subscribers:291,plays:0},
 {id:"back-deck-live",title:"Back Deck Live",host:"CrowRules Community",genre:"conversation",tag:"Live community transmissions",art:"https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=85",episodes:5,subscribers:119,plays:0},
 {id:"night-shift",title:"The Night Shift",host:"CrowRules Network",genre:"comedy",tag:"Late-night stories and laughs",art:"https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1000&q=85",episodes:18,subscribers:156,plays:0},
 {id:"dreamscapes",title:"Dreamscapes",host:"CrowRules Originals",genre:"storytelling",tag:"Ideas become worlds",art:"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=85",episodes:9,subscribers:204,plays:0}
];

const state={
 points:Number(localStorage.getItem("cr_points")||0),
 shows:FALLBACK_SHOWS,
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
 el.innerHTML='<header class="nav"><a class="wordmark" href="home.html">CROWRULES<span>/ PODCASTING</span></a><nav><a href="home.html">Home</a><a href="discover.html">Discover</a><a href="charts.html">Charts</a><a href="live.html">Live</a><a href="schedule.html">Schedule</a><a href="library.html">Library</a><a href="studio.html">Create</a></nav><div class="nav-actions"><a href="notifications.html" class="points-pill" aria-label="Notifications">◌</a><a href="crowpoints.html" class="points-pill" aria-label="CrowPoints">◉ <b>'+state.points+'</b></a><a class="points-pill github-link" href="https://github.com/crowrulesentertainment-oss/podcasting" target="_blank" rel="noopener noreferrer">GitHub</a><a href="account.html" class="avatar" id="accountAvatar">CR</a></div></header><div class="network-bar"><a href="search.html">⌕ Search</a><a href="creators.html">Creators</a><a href="subscriptions.html">Subscriptions</a><a href="crowpoints.html">CrowPoints</a><a href="help.html">Help</a></div>';
 window.addEventListener("scroll",()=>document.querySelector(".nav")?.classList.toggle("scrolled",scrollY>12),{passive:true});
}

function player(){
 if(document.querySelector(".player"))return;
 document.body.insertAdjacentHTML("beforeend",'<div class="player" id="player"><img class="player-art" id="playerArt" src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80" alt=""><div class="player-info"><b id="playerTitle">Nothing playing</b><span id="playerMeta">CrowRules Podcasting</span></div><div class="player-controls"><button data-prev aria-label="Previous">↶</button><button class="main" data-toggle aria-label="Play">▶</button><button data-next aria-label="Next">↷</button></div><div class="player-progress"><i id="playerProgress"></i></div><audio id="crAudio" preload="metadata"></audio></div>');
 const a=document.getElementById("crAudio");
 a.addEventListener("timeupdate",()=>{if(!a.duration)return;state.progress=(a.currentTime/a.duration)*100;document.getElementById("playerProgress").style.width=state.progress+"%";});
 a.addEventListener("loadedmetadata",()=>state.duration=a.duration);
 a.addEventListener("ended",()=>{addPoints(10);toast("+10 CrowPoints • episode completed");playNext()});
}

function card(s){
 return '<article class="show-card" data-genre="'+esc(s.genre)+'"><a href="podcast.html?show='+encodeURIComponent(s.slug||s.id)+'"><img src="'+esc(s.art)+'" alt="'+esc(s.title)+' artwork" loading="lazy" onerror="this.style.display=\'none\'"><div class="card-copy"><span class="badge">'+esc(s.genre)+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.tag||s.description||"")+'</p><small>'+Number(s.episodes||0)+' episodes • '+esc(s.host||"CrowRules Creator")+'</small></div></a><div class="card-tools"><button data-like>♡</button><button data-follow>Follow</button><button data-share>Share</button><button data-save>☆</button></div></article>';
}

async function loadData(){
 if(!isConfigured){state.shows=FALLBACK_SHOWS;return}
 try{
  state.supabase=await getSupabase();
  const {data,error}=await state.supabase.from("podcasts").select("id,title,slug,category,description,artwork_url,status,is_featured,is_live,listener_count,total_plays,creator_id,creators(name)").eq("status","published").order("is_featured",{ascending:false}).order("created_at",{ascending:false});
  if(error)throw error;
  const rows=data||[];
  if(rows.length){
   const ep=await state.supabase.from("podcast_episodes").select("id,podcast_id,title,slug,description,episode_number,season_number,published_at,duration_seconds,audio_url,video_url,thumbnail_url,transcript,show_notes,status,play_count,access_level").eq("status","published").order("published_at",{ascending:false});
   state.episodes=ep.data||[];
   state.shows=rows.map(p=>{const es=state.episodes.filter(e=>e.podcast_id===p.id);return {id:p.id,dbId:p.id,slug:p.slug,title:p.title,host:p.creators?.name||"CrowRules Creator",genre:(p.category||"Podcast").toLowerCase(),tag:p.description||"CrowRules Podcasting transmission",description:p.description,art:p.artwork_url||"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=85",episodes:es.length,subscribers:0,plays:Number(p.total_plays||0),listener_count:Number(p.listener_count||0),live:Boolean(p.is_live),episodeRows:es}};
  });
  }
 }catch(err){console.warn("Podcasting data fallback:",err);state.shows=FALLBACK_SHOWS;toast("Live database unavailable • demo catalog active")}
}

async function loadAuth(){
 if(!state.supabase)return;
 const {data}=await state.supabase.auth.getUser();
 state.user=data?.user||null;
 const avatar=document.getElementById("accountAvatar");
 if(avatar)avatar.textContent=state.user?(state.user.user_metadata?.name||state.user.email||"CR").slice(0,2).toUpperCase():"CR";
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

async function followPodcast(id,button){
 if(!state.supabase||!state.user){toast("Sign in to follow a podcast");return}
 const podcast=state.shows.find(s=>s.id===id||s.dbId===id);
 if(!podcast?.dbId){toast("Follow is available for database podcasts");return}
 const {error}=await state.supabase.from("podcast_follows").upsert({user_id:state.user.id,podcast_id:podcast.dbId},{onConflict:"user_id,podcast_id"});
 if(error){toast("Unable to follow right now");return}
 button.textContent="Following";addPoints(5);toast("+5 CrowPoints • following");
}

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
 const room=new URLSearchParams(location.search).get("room")||"community";document.getElementById("roomTitle").textContent=room.replaceAll("-"," ");
 f.onsubmit=async e=>{e.preventDefault();const input=document.getElementById("chatInput"),box=document.getElementById("messages"),textValue=input.value.trim();if(!textValue)return;box.insertAdjacentHTML("beforeend",'<div><b>You</b><span>'+esc(textValue)+'</span></div>');input.value="";box.scrollTop=box.scrollHeight;addPoints(2);toast("+2 CrowPoints • message sent")};
}

async function forms(){
 document.querySelectorAll("[data-demo-form]").forEach(f=>f.onsubmit=async e=>{
  e.preventDefault();
  if(f.matches('[data-demo-form]')&&f.closest("main")?.querySelector("h1")?.textContent.includes("Create a podcast")){
   if(!state.supabase||!state.user){toast("Sign in before creating a podcast");return}
   const fd=new FormData(f);const {error}=await state.supabase.from("podcasts").insert({title:fd.get("name"),slug:String(fd.get("name")).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),description:fd.get("description")||"",category:fd.get("genre")||"Podcast",artwork_url:fd.get("artwork_url")||null,status:"draft"});
   if(error){toast("Could not create podcast: "+error.message);return}toast("Podcast draft created in Supabase");
  }else toast("Draft saved • connect the creator workflow to persist");
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
  else if(b.dataset.save!==undefined){b.textContent=b.textContent.includes("Save")||b.textContent==="☆"?"★ Saved":"☆ Save";if(b.textContent.includes("Saved")){addPoints(4);toast("+4 CrowPoints • saved")}}
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
function schedule(){const el=document.getElementById("schedule");if(!el)return;el.innerHTML=state.shows.slice(0,8).map((s,i)=>'<div class="slot"><time>'+["03:00 PM","05:30 PM","08:00 PM","09:30 PM","10:00 PM","11:30 PM","12:30 AM","01:30 AM"][i]+'</time><div><h3>'+esc(s.title)+'</h3><p>'+esc(s.host)+' • '+esc(s.tag)+'</p></div><a class="btn" href="podcast.html?show='+encodeURIComponent(s.slug||s.id)+'">Open</a></div>').join("")}

async function boot(){
 nav();player();await loadData();await loadAuth();await renderRails();await loadLibrary();discover();showPage();charts();chat();forms();actions();creators();creator();schedule();
 if(state.supabase)state.supabase.auth.onAuthStateChange((_e,s)=>{state.user=s?.user||null;const a=document.getElementById("accountAvatar");if(a)a.textContent=state.user?(state.user.email||"CR").slice(0,2).toUpperCase():"CR"});
}
boot();
