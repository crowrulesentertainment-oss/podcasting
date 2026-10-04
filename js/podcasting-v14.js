(()=>{"use strict";
if(window.__CROW_V14__ )return;window.__CROW_V14__=true;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function ready(){
 for(let i=0;i<120;i++){
  if(window.CROW_INTELLIGENCE&&window.CROW_SUPABASE)return;
  await wait(100);
 }
}
function toast(msg){
 let t=qs("#crV14Toast");if(!t){t=document.createElement("div");t.id="crV14Toast";t.className="crv14-toast";document.body.appendChild(t)}
 t.textContent=msg;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),3000)
}
function style(){
 if(qs("#crV14Style"))return;const s=document.createElement("style");s.id="crV14Style";s.textContent=`
.crv14-toast{position:fixed;right:18px;bottom:90px;z-index:12000;padding:11px 14px;border:1px solid #65f2ff44;border-radius:11px;background:#07111aef;color:#dffaff;font:700 .62rem Montserrat;box-shadow:0 15px 50px #0009;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s}.crv14-toast.show{opacity:1;transform:none}
.crv14-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.crv14-btn{border:1px solid #65f2ff3d;background:#65f2ff0b;color:#dffaff;border-radius:9px;padding:9px 12px;cursor:pointer;font:800 .62rem Montserrat}.crv14-btn:hover{border-color:#65f2ff88}.crv14-btn.active{background:#65f2ff18;border-color:#65f2ff;color:#fff}.crv14-badge{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 5px;border-radius:99px;background:#ff4f91;color:#fff;font:900 9px Montserrat;margin-left:5px}.crv14-continue{display:grid;gap:9px}.crv14-progress{height:4px;background:#ffffff10;border-radius:99px;overflow:hidden;margin-top:9px}.crv14-progress i{display:block;height:100%;background:linear-gradient(90deg,#65f2ff,#a778ff)}.crv14-intel{margin:14px 0;padding:14px;border:1px solid #ffffff12;border-radius:13px;background:#ffffff04}.crv14-intel h3{font:800 .78rem Orbitron;margin:0 0 8px}.crv14-intel p{margin:0;color:#8b98aa;font-size:.62rem;line-height:1.6}
`;document.head.appendChild(s)}
function user(){return window.__CROW_USER||null}
async function episode(id){const sb=window.CROW_SUPABASE;if(!sb||!id)return null;const r=await sb.from("podcast_episodes").select("id,title,audio_url,thumbnail_url,duration_seconds,podcast_id,podcasts(title,artwork_url)").eq("id",id).maybeSingle();return r.error?null:r.data}
function play(e){if(!e)return;const p=e.podcasts||{};window.CROW_PLAYER?.load({id:e.id,title:e.title,creator:p.title||"CrowRules Podcasting",url:e.audio_url,position:0},true)}
async function renderContinue(targetId,limit=8){
 const el=qs(targetId);if(!el)return;
 const u=user();if(!u){el.innerHTML='<div class="notice">Sign in to unlock synchronized Continue Listening.</div>';return}
 const rows=await window.CROW_INTELLIGENCE.continueListening(limit);const ids=[...new Set(rows.map(x=>x.episode_id).filter(Boolean))];if(!ids.length){el.innerHTML='<div class="notice">Nothing waiting to be finished yet. Start an episode and your progress will appear here.</div>';return}
 const sb=window.CROW_SUPABASE;const r=await sb.from("podcast_episodes").select("id,title,thumbnail_url,duration_seconds,podcast_id,podcasts(title)").in("id",ids);const by=new Map((r.data||[]).map(x=>[x.id,x]));el.innerHTML='<div class="crv14-continue">'+ids.map(id=>{const e=by.get(id),h=rows.find(x=>x.episode_id===id);if(!e)return"";const pct=Math.min(100,Math.max(0,Number(h.position_seconds||0)/Math.max(1,Number(h.duration_seconds||e.duration_seconds||1))*100));return '<button class="card crv14-continue-item" data-v14-episode="'+esc(id)+'" style="text-align:left;padding:13px;border:1px solid #ffffff12;border-radius:12px;background:#ffffff03;color:inherit;cursor:pointer"><b>'+esc(e.title)+'</b><small style="display:block;color:#65f2ff;margin-top:4px">'+esc(e.podcasts?.title||"CrowRules Podcasting")+'</small><div class="crv14-progress"><i style="width:'+pct+'%"></i></div></button>'}).join("")+'</div>';el.querySelectorAll("[data-v14-episode]").forEach(b=>b.onclick=async()=>play(await episode(b.dataset.v14Episode)))}
async function followControls(podcastId,mount){
 if(!podcastId||!mount)return;const u=user();mount.innerHTML='<div class="crv14-actions"><button class="crv14-btn" data-v14-follow>FOLLOW</button><button class="crv14-btn" data-v14-sub>SUBSCRIBE</button></div>';const f=mount.querySelector("[data-v14-follow]"),s=mount.querySelector("[data-v14-sub]");
 if(!u){f.onclick=()=>location.href=BASE+"account.html?redirect="+encodeURIComponent(location.href);s.onclick=f.onclick;return}
 const sb=window.CROW_SUPABASE;let following=false,subscribed=false;
 try{const r=await sb.from("podcast_follows").select("podcast_id").eq("user_id",u.id).eq("podcast_id",podcastId).maybeSingle();following=!!r.data}catch(_){}
 try{const r=await sb.from("podcast_subscriptions").select("podcast_id").eq("user_id",u.id).eq("podcast_id",podcastId).maybeSingle();subscribed=!!r.data}catch(_){}
 const paint=()=>{f.textContent=following?"✓ FOLLOWING":"FOLLOW";s.textContent=subscribed?"✓ SUBSCRIBED":"SUBSCRIBE";f.classList.toggle("active",following);s.classList.toggle("active",subscribed)};paint();
 f.onclick=async()=>{const r=following?await window.CROW_INTELLIGENCE.unfollowPodcast(podcastId):await window.CROW_INTELLIGENCE.followPodcast(podcastId);if(!r.error){following=!following;paint();toast(following?"Podcast followed":"Podcast unfollowed")}else toast(r.error)};
 s.onclick=async()=>{const r=subscribed?await window.CROW_INTELLIGENCE.unsubscribePodcast(podcastId):await window.CROW_INTELLIGENCE.subscribePodcast(podcastId);if(!r.error){subscribed=!subscribed;paint();toast(subscribed?"Podcast subscribed":"Podcast unsubscribed")}else toast(r.error)}
}
async function notificationBadge(){
 const n=qs("#cr13Notify");if(!n)return;const u=user();if(!u)return;const sb=window.CROW_SUPABASE;try{const r=await sb.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",u.id).eq("is_read",false);const count=r.count||0;let b=n.querySelector(".crv14-badge");if(count&&!b){b=document.createElement("span");b.className="crv14-badge";n.appendChild(b)}if(b)b.textContent=count>99?"99+":count}catch(_){}}
async function home(){
 await renderContinue("#continueList",8);
 qsa(".play").forEach(b=>{if(b.dataset.v14Bound)return;b.dataset.v14Bound="1";b.addEventListener("click",async()=>{const id=b.dataset.episodeId||b.closest("[data-episode-id]")?.dataset.episodeId;if(id)play(await episode(id))})});
}
async function library(){
 await renderContinue("#continueListening",12);
 const u=user(),sb=window.CROW_SUPABASE;if(!u||!sb)return;
 const f=await sb.from("podcast_follows").select("podcast_id,podcasts(id,title,description,artwork_url)").eq("user_id",u.id).order("created_at",{ascending:false}).limit(20);
 const el=qs("#follows");if(el)el.innerHTML=(f.data||[]).map(x=>x.podcasts?'<a class="card" href="podcast.html?id='+encodeURIComponent(x.podcasts.id)+'"><h3>'+esc(x.podcasts.title)+'</h3><p>'+esc((x.podcasts.description||"").slice(0,160))+'</p></a>':"").join("")||'<div class="notice">Follow a podcast to build your library.</div>';
}
async function podcast(){
 const id=new URLSearchParams(location.search).get("id")||new URLSearchParams(location.search).get("slug");if(!id)return;
 const sb=window.CROW_SUPABASE;if(!sb)return;let q=sb.from("podcasts").select("id,title,slug").eq("status","published");q=/^[0-9a-f-]{36}$/i.test(id)?q.eq("id",id):q.eq("slug",id);const r=await q.maybeSingle();if(r.error||!r.data)return;
 let mount=qs("#v14PodcastActions");if(!mount){mount=document.createElement("div");mount.id="v14PodcastActions";const hero=qs("#hero");(hero?.querySelector(".hero-copy")||hero||document.body).appendChild(mount)}
 await followControls(r.data.id,mount);
 qsa("button").forEach(b=>{const t=(b.textContent||"").toLowerCase();if(t.includes("play")&&b.id!=="universalPlay"&&!b.dataset.v14Play){b.dataset.v14Play="1"}});
}
async function episodePage(){
 const id=new URLSearchParams(location.search).get("id");if(!id)return;const e=await episode(id);if(!e)return;
 let mount=qs("#v14EpisodeActions");if(!mount){mount=document.createElement("div");mount.id="v14EpisodeActions";mount.className="crv14-intel";const host=qs("#episode")||document.body;host.appendChild(mount)}
 mount.innerHTML='<h3>LISTENING INTELLIGENCE</h3><p>Your universal player remembers this episode across CrowRules Podcasting. Follow the show from its podcast page to keep it in your library.</p><div class="crv14-actions"><button class="crv14-btn" id="v14EpisodePlay">▶ PLAY IN UNIVERSAL PLAYER</button><a class="crv14-btn" href="podcast.html?id='+encodeURIComponent(e.podcast_id)+'">VIEW SHOW</a></div>';qs("#v14EpisodePlay").onclick=()=>play(e)
}
async function creators(){
 const host=qs("main")||document.body;if(qs("#v14CreatorIntel"))return;const box=document.createElement("section");box.id="v14CreatorIntel";box.className="crv14-intel";box.innerHTML='<h3>CREATOR INTELLIGENCE</h3><p>Creator pages now share the same CrowRules player, account context and discovery runtime.</p><div class="crv14-actions"><a class="crv14-btn" href="creator-intelligence.html">OPEN CREATOR INTELLIGENCE</a><a class="crv14-btn" href="create-podcast.html">CREATE A PODCAST</a></div>';host.appendChild(box)}
async function boot(){style();await ready();notificationBadge();window.addEventListener("crow:intelligence-ready",()=>{notificationBadge()});window.addEventListener("crow:notifications-changed",notificationBadge);
 const p=(location.pathname.split("/").pop()||"home.html").toLowerCase();
 if(p==="home.html"||p==="" )await home();else if(p==="library.html")await library();else if(p==="podcast.html")await podcast();else if(p==="episode.html")await episodePage();else if(["creator-profile.html","creator-dashboard.html","creator-intelligence.html"].includes(p))await creators();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();