(()=>{"use strict";
if(window.__CROW_PODCASTING_V13_INTELLIGENCE__)return;
window.__CROW_PODCASTING_V13_INTELLIGENCE__=true;
const SESSION=crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();
const CHANNEL="crowrules-podcasting-live-v14";
const PUBLIC_TABLES=["podcasts","podcast_episodes","creators","podcast_creator_activity","podcast_follows","podcast_subscriptions"];
const MEMBER_TABLES=["podcast_notifications","podcast_episode_progress"];
const api={version:"14.1.0",sessionId:SESSION,state:{user:null,realtimeStatus:"STANDBY"},events:new EventTarget(),channel:null,retryTimer:null,booted:false};
const emit=(n,d)=>{api.events.dispatchEvent(new CustomEvent(n,{detail:d}));window.dispatchEvent(new CustomEvent("crow:v13:"+n,{detail:d}))};
const client=async()=>window.CROW_SUPABASE||(window.CROW_SUPABASE_READY?await window.CROW_SUPABASE_READY.catch(()=>null):null);
const uid=()=>window.__CROW_USER?.id||api.state.user?.id||null;
async function search(q,limit=24){const sb=await client();q=String(q||"").trim().replace(/[%_,]/g," ");if(!sb||q.length<2)return[];const r=await sb.from("podcast_v13_search_index").select("result_type,id,slug,title,description,image_url,category,creator_id,created_at").or("title.ilike.%"+q+"%,description.ilike.%"+q+"%,category.ilike.%"+q+"%").order("created_at",{ascending:false}).limit(limit);if(r.error)throw r.error;emit("search",r.data||[]);return r.data||[]}
async function saveProgress(episodeId,position,duration,completed=false){const sb=await client(),id=uid();if(!sb||!id||!episodeId)return null;const pct=Math.min(100,Math.max(0,Number(duration)>0?Number(position)/Number(duration)*100:0));const r=await sb.from("podcast_episode_progress").upsert({user_id:id,episode_id:episodeId,position_seconds:Math.floor(Number(position)||0),duration_seconds:Math.floor(Number(duration)||0),percent_complete:pct,completed:completed||pct>=95,last_played_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"}).select().maybeSingle();if(!r.error)emit("progress",r.data);return r.data||null}
async function continueListening(limit=20){const sb=await client(),id=uid();if(!sb||!id)return[];const r=await sb.from("podcast_episode_progress").select("*,episode:podcast_episodes(id,title,slug,audio_url,thumbnail_url,duration_seconds,podcast_id)").eq("user_id",id).eq("completed",false).order("last_played_at",{ascending:false}).limit(limit);if(r.error)throw r.error;emit("continue-listening",r.data||[]);return r.data||[]}
async function relation(table,podcastId,on){const sb=await client(),id=uid();if(!sb||!id)return{error:"Sign in required"};const r=on?await sb.from(table).upsert({user_id:id,podcast_id:podcastId},{onConflict:"user_id,podcast_id"}):await sb.from(table).delete().eq("user_id",id).eq("podcast_id",podcastId);if(r.error)return{error:r.error.message};emit(table==="podcast_follows"?"follow":"subscription",{podcastId,active:on});return{data:r.data}}
async function notifications(limit=30){const sb=await client(),id=uid();if(!sb||!id)return[];const r=await sb.from("podcast_notifications").select("*").eq("user_id",id).order("created_at",{ascending:false}).limit(limit);if(r.error)throw r.error;api.state.notifications=r.data||[];api.state.unread=api.state.notifications.filter(x=>!x.is_read).length;emit("notifications",api.state.notifications);return api.state.notifications}
async function markNotificationRead(id){const sb=await client(),u=uid();if(!sb||!u||!id)return null;const r=await sb.from("podcast_notifications").update({is_read:true}).eq("id",id).eq("user_id",u).select().maybeSingle();if(!r.error)await notifications();return r.data||null}
async function presence(extra={}){const sb=await client(),id=uid();if(!sb||!id)return null;const r=await sb.from("podcast_presence").upsert({user_id:id,session_id:SESSION,page:location.pathname.split("/").pop()||"home.html",mode:extra.mode||"browser",podcast_id:extra.podcast_id||null,episode_id:extra.episode_id||null,content_title:extra.content_title||null,last_seen_at:new Date().toISOString(),metadata:extra.metadata||{}},{onConflict:"user_id,session_id"}).select().maybeSingle();if(!r.error)emit("presence",r.data);return r.data||null}
async function activity(limit=30){const sb=await client();if(!sb)return[];const r=await sb.from("podcast_creator_activity").select("*").order("created_at",{ascending:false}).limit(limit);if(r.error)throw r.error;emit("activity",r.data||[]);return r.data||[]}
function status(s,error){api.state.realtimeStatus=s;api.state.realtimeError=error||null;emit("realtime",{status:s,channel:CHANNEL,error:error||null})}
function retry(sb,delay=5000){clearTimeout(api.retryTimer);api.retryTimer=setTimeout(()=>{api.retryTimer=null;realtime(sb)},delay)}
function realtime(sb){
 if(api.channel||!sb?.channel)return;
 status("CONNECTING");
 const tables=uid()?PUBLIC_TABLES.concat(MEMBER_TABLES):PUBLIC_TABLES;
 const ch=sb.channel(CHANNEL);
 tables.forEach(table=>ch.on("postgres_changes",{event:"*",schema:"public",table},p=>emit(["podcasts","podcast_episodes","creators"].includes(table)?"catalog-change":table+"-change",p)));
 api.channel=ch;
 ch.subscribe((s,err)=>{
   if(s==="SUBSCRIBED"){status("LIVE");return}
   if(s==="CHANNEL_ERROR"||s==="TIMED_OUT"||s==="CLOSED"){
     api.channel=null;try{sb.removeChannel(ch)}catch(_){}
     status("ERROR",err?.message||s);retry(sb);return
   }
   status(s,err?.message||null);
 });
}
async function boot(){
 const sb=await client();
 api.state.user=window.__CROW_USER||null;
 if(!sb){status("ERROR","Supabase unavailable");return}
 if(api.booted){return}
 api.booted=true;
 realtime(sb);
 if(uid())await Promise.allSettled([continueListening(),notifications(),presence()]);
 emit("ready",api);
}
api.search=search;api.saveProgress=saveProgress;api.continueListening=continueListening;api.follow=id=>relation("podcast_follows",id,true);api.unfollow=id=>relation("podcast_follows",id,false);api.subscribe=id=>relation("podcast_subscriptions",id,true);api.unsubscribe=id=>relation("podcast_subscriptions",id,false);api.notifications=notifications;api.markNotificationRead=markNotificationRead;api.presence=presence;api.activity=activity;api.getState=()=>JSON.parse(JSON.stringify(api.state));api.getRealtimeStatus=()=>api.state.realtimeStatus;api.channelName=CHANNEL;
window.CROW_PODCASTING_V13=api;window.CROW_INTELLIGENCE=Object.assign(window.CROW_INTELLIGENCE||{},api);
window.addEventListener("crow:ready",boot,{once:true});
window.addEventListener("crow:auth",()=>{api.state.user=window.__CROW_USER||null;if(api.channel){try{client().then(sb=>sb?.realtime?.setAuth?.())}catch(_){}}});
if(window.CROW_SUPABASE)boot();
})();