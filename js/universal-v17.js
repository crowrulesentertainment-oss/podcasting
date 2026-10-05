(()=>{"use strict";
if(window.__CROW_PODCASTING_V17__)return;window.__CROW_PODCASTING_V17__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
let sb=null,user=null,channel=null,progressTimer=null,searchTimer=null,creatorId=null;

async function client(){return window.CROW_SUPABASE||await (window.CROW_SUPABASE_READY||Promise.resolve(null)).catch(()=>null)}
function api(){return window.CROW_PODCASTING_V13||window.CROW_INTELLIGENCE||null}
function notify(message){if(window.CROW_PODCASTING_V15?.toast)window.CROW_PODCASTING_V15.toast(message);else{let t=$("cr17Toast");if(t){t.textContent=message;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2600)}}}
function mount(){
 if($("cr17Root"))return;
 const r=document.createElement("div");r.id="cr17Root";r.innerHTML=
 '<div id="cr17Status" class="cr17-status" aria-live="polite"><span class="cr17-dot"></span><span id="cr17StatusText">SUPABASE CONNECTING</span></div>'+
 '<button id="cr17Bell" class="cr17-bell" aria-label="Open notifications" title="Notifications">◔<b id="cr17Unread" hidden>0</b></button>'+
 '<div id="cr17Search" class="cr17-overlay" hidden><div class="cr17-searchbox" role="dialog" aria-modal="true" aria-label="CrowRules universal search"><button id="cr17Close" class="cr17-close" aria-label="Close">×</button><span class="cr17-kicker">CROWRULES PODCASTING · V17</span><h2>Search the universe.</h2><input id="cr17Input" autocomplete="off" placeholder="Search podcasts, episodes and creators…"><div id="cr17SearchState" class="cr17-searchstate">Type at least 2 characters.</div><div id="cr17Results" class="cr17-results"></div></div></div>'+
 '<aside id="cr17Continue" class="cr17-continue" hidden><div class="cr17-continue-head"><b>CONTINUE LISTENING</b><button id="cr17ContinueClose">×</button></div><div id="cr17ContinueList"></div></aside>'+
 '<aside id="cr17Notify" class="cr17-notify" hidden><div class="cr17-notify-head"><b>NOTIFICATIONS</b><button id="cr17NotifyClose">×</button></div><div id="cr17NotifyList"></div></aside>'+
 '<div id="cr17CreatorPulse" class="cr17-creator" hidden></div><div id="cr17Toast" hidden></div>';
 document.body.appendChild(r);
 $("cr17Bell").onclick=()=>toggleNotifications(true);
 $("cr17NotifyClose").onclick=()=>toggleNotifications(false);
 $("cr17ContinueClose").onclick=()=>{$("cr17Continue").hidden=true};
 $("cr17Close").onclick=()=>toggleSearch(false);
 $("cr17Search").onclick=e=>{if(e.target===$("cr17Search"))toggleSearch(false)};
 const input=$("cr17Input");
 input.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(input.value),180)});
 addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();toggleSearch(true)}if(e.key==="Escape"){toggleSearch(false);$("cr17Notify").hidden=true}});
}
function toggleSearch(on){const e=$("cr17Search");if(!e)return;e.hidden=!on;if(on){$("cr17Input").value="";$("cr17Results").innerHTML="";$("cr17SearchState").textContent="Type at least 2 characters.";setTimeout(()=>$("cr17Input").focus(),0)}}
async function runSearch(q){
 q=String(q||"").trim();const st=$("cr17SearchState"),out=$("cr17Results");if(!st||!out)return;
 if(q.length<2){st.textContent="Type at least 2 characters.";out.innerHTML="";return}
 const intelligence=api();st.textContent="Searching Supabase…";out.innerHTML="";
 try{
  const rows=intelligence?.search?await intelligence.search(q,30):[];
  if(!rows.length){st.textContent="No matching podcasts, episodes or creators.";return}
  st.textContent=rows.length+" result"+(rows.length===1?"":"s");
  out.innerHTML=rows.map(x=>{
   const type=x.result_type||"result",href=type==="podcast"?"podcast.html?slug="+encodeURIComponent(x.slug||x.id):type==="episode"?"episode.html?slug="+encodeURIComponent(x.slug||x.id):"creator-profile.html?creator_id="+encodeURIComponent(x.id);
   return '<a class="cr17-result" href="'+BASE+href+'">'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="">':'<span class="cr17-result-art">◉</span>')+'<span><b>'+esc(x.title)+'</b><small>'+esc(type.toUpperCase())+(x.category?" · "+esc(x.category):"")+'</small><em>'+esc((x.description||"").slice(0,150))+'</em></span></a>'
  }).join("");
 }catch(e){st.textContent="Search is temporarily unavailable.";notify("Universal search could not reach Supabase.");console.warn("CrowRules V17 search:",e)}
}
async function loadNotifications(){
 if(!user||!sb){updateUnread(0);return[]}
 try{const r=await sb.from("podcast_notifications").select("id,type,title,body,is_read,created_at,episode_id,podcast_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(25);if(r.error)throw r.error;const rows=r.data||[];updateUnread(rows.filter(x=>!x.is_read).length);return rows}catch(e){updateUnread(0);return[]}
}
function updateUnread(n){const b=$("cr17Unread");if(!b)return;b.textContent=n;b.hidden=!n}
async function toggleNotifications(on){
 const panel=$("cr17Notify");if(!panel)return;panel.hidden=!on;if(!on)return;
 const list=$("cr17NotifyList");list.innerHTML='<div class="cr17-empty">Loading…</div>';
 const rows=await loadNotifications();
 if(!rows.length){list.innerHTML='<div class="cr17-empty">'+(user?"No notifications yet.":"Sign in to receive notifications.")+'</div>';return}
 list.innerHTML=rows.map(x=>'<button class="cr17-notification '+(x.is_read?"":"unread")+'" data-notify="'+esc(x.id)+'"><b>'+esc(x.title||x.type||"CrowRules update")+'</b><p>'+esc(x.body||"")+'</p><small>'+new Date(x.created_at).toLocaleString()+'</small></button>').join("");
 list.querySelectorAll("[data-notify]").forEach(b=>b.onclick=async()=>{if(!sb||!user)return;await sb.from("podcast_notifications").update({is_read:true}).eq("id",b.dataset.notify).eq("user_id",user.id);await toggleNotifications(true)});
}
async function continueListening(){
 if(!user||!sb)return[];
 try{
  if(api()?.continueListening)return await api().continueListening(12);
  const r=await sb.from("podcast_episode_progress").select("*,episode:podcast_episodes(id,title,slug,audio_url,thumbnail_url,duration_seconds,podcast_id)").eq("user_id",user.id).eq("completed",false).order("last_played_at",{ascending:false}).limit(12);
  return r.error?[]:(r.data||[]);
 }catch{return[]}
}
async function renderContinue(){
 const panel=$("cr17Continue"),list=$("cr17ContinueList");if(!panel||!list)return;
 const rows=await continueListening();
 if(!rows.length){panel.hidden=true;return}
 panel.hidden=false;
 list.innerHTML=rows.map(x=>{
  const e=x.episode||x;const pct=Math.max(0,Math.min(100,Number(x.percent_complete||0)));
  return '<button class="cr17-continue-item" data-continue="'+esc(e.id||x.episode_id)+'" data-url="'+esc(e.audio_url||"")+'"><span class="cr17-result-art">'+(e.thumbnail_url?'<img src="'+esc(e.thumbnail_url)+'" alt="">':'◉')+'</span><span><b>'+esc(e.title||"Episode")+'</b><small>'+Math.round(pct)+'% complete</small><i><em style="width:'+pct+'%"></em></i></span></button>'
 }).join("");
 list.querySelectorAll("[data-continue]").forEach(b=>b.onclick=()=>resume(b.dataset.continue,b.dataset.url));
}
async function resume(id,url){
 const p=window.CROW_PLAYER;
 const v=window.CROW_PLAYER_V13_3;
 if(v?.load){try{await v.load({id,title:"Continue Listening",url});return}catch{}}
 if(p?.load&&url){p.load({id,title:"Continue Listening",url},true);return}
 location.href=BASE+"episode.html?id="+encodeURIComponent(id);
}
function currentItem(){
 const st=window.CROW_PLAYER_V13_3?.state?.();const c=st?.items?.[st.currentIndex];if(c)return c;
 const p=window.CROW_PLAYER;return p?.current||null;
}
function bindProgress(){
 if(!user||!sb)return;
 const a=document.getElementById("cr13Audio")||document.querySelector(".cr13-player audio")||document.querySelector("audio");
 if(!a||a.dataset.cr17Progress==="1")return;
 a.dataset.cr17Progress="1";
 const save=async(force=false)=>{
  const item=currentItem(),id=item?.id||a.dataset.episodeId||a.dataset.episode;
  if(!id||!a.duration||!isFinite(a.duration))return;
  const pct=a.currentTime/a.duration*100;
  if(!force&&pct<1)return;
  if(api()?.saveProgress){await api().saveProgress(id,a.currentTime,a.duration,pct>=95);return}
  try{await sb.from("podcast_episode_progress").upsert({user_id:user.id,episode_id:id,position_seconds:Math.floor(a.currentTime),duration_seconds:Math.floor(a.duration),percent_complete:pct,completed:pct>=95,last_played_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"})}catch{}
 };
 ["play","pause","ended"].forEach(ev=>a.addEventListener(ev,()=>save(ev!=="play")));
 a.addEventListener("timeupdate",()=>{if(Math.floor(a.currentTime)%15===0)save(false)});
 clearInterval(progressTimer);progressTimer=setInterval(()=>save(false),15000);
}
async function creatorPulse(){
 if(!user||!sb)return;
 try{
  let q=await sb.rpc("get_my_podcast_creator_id");creatorId=q.error?null:q.data;
  if(!creatorId){const c=await sb.from("creators").select("id").eq("member_id",user.id).maybeSingle();creatorId=c.data?.id||null}
  if(!creatorId)return;
  const [s,a]=await Promise.all([
   sb.from("creator_intelligence_snapshots").select("followers,subscribers,plays,minutes_listened,health_score,snapshot_date").eq("creator_id",creatorId).order("snapshot_date",{ascending:false}).limit(1).maybeSingle(),
   sb.from("creator_realtime_alerts").select("id,title,severity").eq("creator_id",creatorId).eq("is_read",false).order("created_at",{ascending:false}).limit(3)
  ]);
  const host=$("cr17CreatorPulse");if(!host)return;
  host.hidden=false;const x=s.data||{};host.innerHTML='<span>CREATOR PULSE</span><b>'+Number(x.health_score||0)+'/100</b><small>'+Number(x.followers||0).toLocaleString()+' followers · '+Number(x.subscribers||0).toLocaleString()+' subscribers'+(a.data?.length?" · "+a.data.length+" alert"+(a.data.length===1?"":"s"):"")+'</small>';
 }catch{}
}
function setStatus(text,ok){const e=$("cr17StatusText"),r=$("cr17Status");if(e)e.textContent=text;if(r)r.classList.toggle("online",!!ok)}
function realtime(){
 if(!sb||channel)return;
 const tables=["podcasts","podcast_episodes","creators","podcast_notifications","podcast_episode_progress","podcast_follows","podcast_subscriptions","creator_intelligence_snapshots","creator_realtime_alerts"];
 let ch=sb.channel("crowrules-podcasting-v17-universal");
 tables.forEach(table=>ch.on("postgres_changes",{event:"*",schema:"public",table},p=>{
  window.dispatchEvent(new CustomEvent("crow:v17:data",{detail:{table,payload:p}}));
  if(["podcast_notifications","podcast_episode_progress"].includes(table)){loadNotifications();renderContinue()}
  if(["creator_intelligence_snapshots","creator_realtime_alerts"].includes(table))creatorPulse();
 }));
 channel=ch;
 ch.subscribe(status=>{setStatus(status==="SUBSCRIBED"?"SUPABASE LIVE":status,status==="SUBSCRIBED")});
}
function authUI(){
 user=window.__CROW_USER||null;
 document.body.classList.toggle("cr17-signed-in",!!user);
 if(!user){updateUnread(0);$("cr17Continue").hidden=true;$("cr17CreatorPulse").hidden=true}
 else{loadNotifications();renderContinue();creatorPulse();bindProgress()}
}
async function boot(){
 mount();sb=await client();
 if(!sb){setStatus("SUPABASE OFFLINE",false);return}
 try{user=window.__CROW_USER||(await sb.auth.getUser()).data?.user||null}catch{user=null}
 setStatus("SUPABASE ONLINE",true);authUI();realtime();
 window.addEventListener("crow:auth",()=>{authUI();setTimeout(bindProgress,200)});
 window.addEventListener("crow:v13:ready",bindProgress);
 window.addEventListener("crow:v13:progress",renderContinue);
 window.addEventListener("crow:v13:notifications",()=>loadNotifications());
 setTimeout(bindProgress,1200);setTimeout(renderContinue,1400);
}
window.CROW_PODCASTING_V17={
 version:"17.0.0",
 search:runSearch,
 openSearch:()=>toggleSearch(true),
 closeSearch:()=>toggleSearch(false),
 notifications:loadNotifications,
 continueListening,
 creatorIntelligence:creatorPulse,
 saveProgress:async(...a)=>api()?.saveProgress?.(...a),
 realtime:()=>channel
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,350));else setTimeout(boot,350);
})();