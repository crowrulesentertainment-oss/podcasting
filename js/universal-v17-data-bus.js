(()=>{"use strict";
if(window.__CROW_PODCASTING_V17_2_BUS__)return;
window.__CROW_PODCASTING_V17_2_BUS__=true;

const VERSION="17.3.0";
const SESSION=window.__CROW_PODCASTING_V17_SESSION__||(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random());
let sb=null,user=null,channel=null,presenceTimer=null;
const cache={notifications:[],continueListening:[],follows:[],subscriptions:[],presence:null,creator:null,playerQueue:null};
const listeners=new Map();
const migration={directSupabase:0,delegated:0,startedAt:new Date().toISOString()};
const delegate=(name,fn)=>async(...args)=>{migration.delegated++;try{return await fn(...args)}catch(e){console.warn("CrowRules V17.3 "+name,e);throw e}};

const emit=(topic,detail={})=>{
  const payload={topic,...detail};
  window.dispatchEvent(new CustomEvent("crow:v17:"+topic,{detail:payload}));
  window.dispatchEvent(new CustomEvent("crow:v17:data",{detail:payload}));
  (listeners.get(topic)||[]).forEach(fn=>{try{fn(payload)}catch(e){console.warn("CrowRules V17.2 listener",e)}});
  (listeners.get("*")||[]).forEach(fn=>{try{fn(payload)}catch(e){console.warn("CrowRules V17.2 listener",e)}});
};
const on=(topic,fn)=>{if(typeof fn!=="function")return()=>{};const a=listeners.get(topic)||[];a.push(fn);listeners.set(topic,a);return()=>{const i=a.indexOf(fn);if(i>=0)a.splice(i,1)}};
const uid=()=>user?.id||window.__CROW_USER?.id||null;

async function client(){
  if(window.CROW_SUPABASE)return window.CROW_SUPABASE;
  if(window.CROW_SUPABASE_READY)return window.CROW_SUPABASE_READY.catch(()=>null);
  if(window.CROW_CONFIG_CLIENT_READY)return window.CROW_CONFIG_CLIENT_READY.catch(()=>null);
  return null;
}
async function ready(){
  sb=sb||await client();
  if(!sb)return null;
  if(!user){try{user=window.__CROW_USER||(await sb.auth.getUser()).data?.user||null}catch{}}
  return sb;
}
async function refreshAuth(){
  const db=await ready(); if(!db)return null;
  try{user=(await db.auth.getUser()).data?.user||null}catch{user=null}
  window.__CROW_USER=user;
  emit("auth",{user});
  return user;
}

async function search(query,limit=30){
  const db=await ready(); query=String(query||"").trim().replace(/[%,_]/g," ");
  if(!db||query.length<2)return[];
  if(window.CROW_PODCASTING_V13?.search){
    try{return await window.CROW_PODCASTING_V13.search(query,limit)}catch{}
  }
  const r=await db.from("podcast_v13_search_index").select("result_type,id,slug,title,description,image_url,category,creator_id,created_at").or("title.ilike.%"+query+"%,description.ilike.%"+query+"%,category.ilike.%"+query+"%").order("created_at",{ascending:false}).limit(limit);
  if(r.error)throw r.error; emit("search",{rows:r.data||[],query}); return r.data||[];
}

async function notifications(limit=30){
  const db=await ready(),id=uid(); if(!db||!id){cache.notifications=[];return[]}
  const r=await db.from("podcast_notifications").select("*").eq("user_id",id).order("created_at",{ascending:false}).limit(limit);
  if(r.error)throw r.error; cache.notifications=r.data||[]; emit("notifications",{rows:cache.notifications,unread:cache.notifications.filter(x=>!x.is_read).length}); return cache.notifications;
}
async function markNotificationRead(id){
  const db=await ready(),u=uid(); if(!db||!u||!id)return null;
  const r=await db.from("podcast_notifications").update({is_read:true}).eq("id",id).eq("user_id",u).select().maybeSingle();
  if(r.error)throw r.error; await notifications(); emit("notification-read",{id}); return r.data||null;
}

async function continueListening(limit=20){
  const db=await ready(),id=uid(); if(!db||!id){cache.continueListening=[];return[]}
  if(window.CROW_PODCASTING_V13?.continueListening){
    try{const rows=await window.CROW_PODCASTING_V13.continueListening(limit);cache.continueListening=rows||[];emit("continue-listening",{rows:cache.continueListening});return cache.continueListening}catch{}
  }
  const r=await db.from("podcast_episode_progress").select("*,episode:podcast_episodes(id,title,slug,audio_url,thumbnail_url,duration_seconds,podcast_id)").eq("user_id",id).eq("completed",false).order("last_played_at",{ascending:false}).limit(limit);
  if(r.error)throw r.error; cache.continueListening=r.data||[]; emit("continue-listening",{rows:cache.continueListening}); return cache.continueListening;
}

async function saveProgress(episodeId,position,duration,completed=false){
  const db=await ready(),id=uid(); if(!db||!id||!episodeId)return null;
  if(window.CROW_PODCASTING_V13?.saveProgress){
    try{return await window.CROW_PODCASTING_V13.saveProgress(episodeId,position,duration,completed)}catch{}
  }
  const dur=Math.max(0,Number(duration)||0),pos=Math.max(0,Number(position)||0),pct=Math.min(100,dur?pos/dur*100:0);
  const r=await db.from("podcast_episode_progress").upsert({user_id:id,episode_id:episodeId,position_seconds:Math.floor(pos),duration_seconds:Math.floor(dur),percent_complete:pct,completed:!!completed||pct>=95,last_played_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"}).select().maybeSingle();
  if(r.error)throw r.error; emit("progress",{row:r.data,episodeId}); return r.data||null;
}
const getListeningHistory=async(limit=50)=>continueListening(limit);

async function follows(){
  const db=await ready(),id=uid(); if(!db||!id){cache.follows=[];return[]}
  const r=await db.from("podcast_follows").select("*").eq("user_id",id).order("created_at",{ascending:false});
  if(r.error)throw r.error; cache.follows=r.data||[]; emit("follows",{rows:cache.follows}); return cache.follows;
}
async function follow(podcastId){
  const db=await ready(),id=uid(); if(!db||!id)return{error:"Sign in required"};
  const r=await db.from("podcast_follows").upsert({user_id:id,podcast_id:podcastId},{onConflict:"user_id,podcast_id"});
  if(r.error)throw r.error; await follows(); emit("follow",{podcastId,active:true}); return{active:true};
}
async function unfollow(podcastId){
  const db=await ready(),id=uid(); if(!db||!id)return{error:"Sign in required"};
  const r=await db.from("podcast_follows").delete().eq("user_id",id).eq("podcast_id",podcastId);
  if(r.error)throw r.error; await follows(); emit("follow",{podcastId,active:false}); return{active:false};
}

async function subscriptions(){
  const db=await ready(),id=uid(); if(!db||!id){cache.subscriptions=[];return[]}
  const r=await db.from("podcast_subscriptions").select("*").eq("user_id",id).order("created_at",{ascending:false});
  if(r.error)throw r.error; cache.subscriptions=r.data||[]; emit("subscriptions",{rows:cache.subscriptions}); return cache.subscriptions;
}

async function presence(extra={}){
  const db=await ready(),id=uid(); if(!db||!id)return null;
  const row={user_id:id,session_id:SESSION,page:location.pathname.split("/").pop()||"home.html",mode:extra.mode||"browser",podcast_id:extra.podcast_id||null,episode_id:extra.episode_id||null,content_title:extra.content_title||null,last_seen_at:new Date().toISOString(),metadata:extra.metadata||{}};
  const r=await db.from("podcast_presence").upsert(row,{onConflict:"user_id,session_id"}).select().maybeSingle();
  if(r.error)throw r.error; cache.presence=r.data||row; emit("presence",{row:cache.presence}); return cache.presence;
}

async function playerQueue(queue,currentIndex=0,autoplay=true){
  const db=await ready(),id=uid(); if(!db||!id)return null;
  const row={user_id:id,queue:Array.isArray(queue)?queue:[],current_index:Math.max(0,Number(currentIndex)||0),autoplay:!!autoplay,updated_at:new Date().toISOString()};
  const r=await db.from("podcast_player_queue").upsert(row,{onConflict:"user_id"}).select().maybeSingle();
  if(r.error)throw r.error; cache.playerQueue=r.data||row; emit("player-queue",{row:cache.playerQueue}); return cache.playerQueue;
}
async function getPlayerQueue(){
  const db=await ready(),id=uid(); if(!db||!id)return null;
  const r=await db.from("podcast_player_queue").select("*").eq("user_id",id).maybeSingle();
  if(r.error)throw r.error; cache.playerQueue=r.data||null; emit("player-queue",{row:cache.playerQueue}); return cache.playerQueue;
}

async function creatorIntelligence(){
  const db=await ready(),id=uid(); if(!db||!id)return null;
  let creatorId=null;
  try{const q=await db.rpc("get_my_podcast_creator_id");if(!q.error)creatorId=q.data||null}catch{}
  if(!creatorId){try{const q=await db.from("creators").select("id").eq("member_id",id).maybeSingle();creatorId=q.data?.id||null}catch{}}
  if(!creatorId){cache.creator=null;return null}
  const [snap,alerts]=await Promise.all([
    db.from("creator_intelligence_snapshots").select("*").eq("creator_id",creatorId).order("snapshot_date",{ascending:false}).limit(1).maybeSingle(),
    db.from("creator_realtime_alerts").select("*").eq("creator_id",creatorId).eq("is_read",false).order("created_at",{ascending:false}).limit(10)
  ]);
  cache.creator={id:creatorId,snapshot:snap.data||null,alerts:alerts.data||[]}; emit("creator",{data:cache.creator}); return cache.creator;
}

async function bootRealtime(){
  const db=await ready(); if(!db||channel)return;
  const tables=["podcasts","podcast_episodes","creators","podcast_notifications","podcast_episode_progress","podcast_follows","podcast_subscriptions","podcast_presence","podcast_player_queue","creator_intelligence_snapshots","creator_realtime_alerts"];
  channel=db.channel("crowrules-podcasting-v17-2-bus");
  tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table},payload=>{
    emit("realtime",{table,payload});
    if(table==="podcast_notifications")notifications().catch(()=>{});
    if(table==="podcast_episode_progress")continueListening().catch(()=>{});
    if(table==="podcast_follows")follows().catch(()=>{});
    if(table==="podcast_subscriptions")subscriptions().catch(()=>{});
    if(table==="creator_intelligence_snapshots"||table==="creator_realtime_alerts")creatorIntelligence().catch(()=>{});
  }));
  channel.subscribe(status=>emit("connection",{status}));
}

function bindPlayer(){
  const p=window.CROW_PLAYER_V13_3||window.CROW_PLAYER;
  if(!p)return;
  const onPlay=()=>emit("player",{event:"play",item:p.current||null});
  const onPause=()=>emit("player",{event:"pause",item:p.current||null});
  window.addEventListener("crow:v13:progress",e=>emit("player",{event:"progress",detail:e.detail||{}}));
  window.addEventListener("crow:v13:ready",()=>emit("player",{event:"ready"}));
  window.addEventListener("crow:v13:ended",()=>emit("player",{event:"ended"}));
  window.addEventListener("crow:play",e=>emit("player",{event:"play",detail:e.detail||{}}));
  window.addEventListener("crow:player:ended",e=>emit("player",{event:"ended",detail:e.detail||{}}));
}

function snapshot(){return {version:VERSION,migration:{...migration},user,cache:{notifications:[...cache.notifications],continueListening:[...cache.continueListening],follows:[...cache.follows],subscriptions:[...cache.subscriptions],presence:cache.presence,creator:cache.creator,playerQueue:cache.playerQueue}}}

const bus={version:VERSION,sessionId:SESSION,ready,refreshAuth,getSession:async()=>{const db=await ready();return db?(await db.auth.getSession()).data?.session||null:null},getUser:()=>user,
search,notifications,markNotificationRead,continueListening,getListeningHistory,saveProgress,
follows,follow,unfollow,subscriptions,presence,playerQueue,getPlayerQueue,creatorIntelligence,on,emit,bootRealtime,snapshot};

bus.getFollows=bus.follows;bus.getSubscriptions=bus.subscriptions;bus.getPresence=bus.presence;bus.getCreatorIntelligence=bus.creatorIntelligence;bus.getAuth=bus.getUser;
window.CROW_PODCASTING_V17_3=bus;
window.CROW_PODCASTING_V17_2=bus;
window.CROW_DATA_BUS=bus;
window.CROW_PODCASTING_V17=Object.assign(window.CROW_PODCASTING_V17||{},{
  version:VERSION,data:bus,bus,migration:migration,
  getSession:bus.getSession,getUser:bus.getUser,search:bus.search,
  notifications:bus.notifications,markNotificationRead:bus.markNotificationRead,
  continueListening:bus.continueListening,getListeningHistory:bus.getListeningHistory,
  saveProgress:bus.saveProgress,follows:bus.follows,follow:bus.follow,unfollow:bus.unfollow,
  subscriptions:bus.subscriptions,presence:bus.presence,playerQueue:bus.playerQueue,
  getPlayerQueue:bus.getPlayerQueue,creatorIntelligence:bus.creatorIntelligence,
  on:bus.on,snapshot:bus.snapshot
});

async function start(){
  await refreshAuth();
  await bootRealtime();
  bindPlayer();
  if(user)await Promise.allSettled([notifications(),continueListening(),follows(),subscriptions(),presence(),creatorIntelligence(),getPlayerQueue()]);
  emit("ready",{version:VERSION,bus});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,500),{once:true});
else setTimeout(start,500);
window.addEventListener("crow:auth",()=>{refreshAuth().then(()=>{bootRealtime();if(user)Promise.allSettled([notifications(),continueListening(),follows(),subscriptions(),presence(),creatorIntelligence(),getPlayerQueue()])})});
})();