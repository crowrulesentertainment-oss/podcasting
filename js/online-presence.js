(function(){
"use strict";
if(window.__crowRulesPresenceBooting||window.CrowRulesOnline)return;
window.__crowRulesPresenceBooting=true;
var trackerScript=document.currentScript;
var configUrl=new URL("../config.js",trackerScript&&trackerScript.src||location.href).href;
var supabaseUrl="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
function loadScript(src,id){
  return new Promise(function(resolve,reject){
    if(id&&document.getElementById(id)){var existing=document.getElementById(id);if(existing.dataset.loaded==="true")return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return;}
    var script=document.createElement("script");if(id)script.id=id;script.src=src;script.async=true;
    script.onload=function(){script.dataset.loaded="true";resolve()};
    script.onerror=function(){reject(new Error("Could not load "+src))};
    document.head.appendChild(script);
  });
}
function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}))}catch(e){}}
function roleFromUser(user){
  if(!user)return "visitor";
  var meta=user.app_metadata||{},role=String(meta.podcast_role||meta.signup_role||meta.role||"").toLowerCase();
  if(["creator","podcaster","host"].indexOf(role)!==-1)return "creator";
  return "listener";
}
async function start(){
  var cfg=window.CROW_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseKey){
    await loadScript(configUrl,"crowrules-presence-config");
    cfg=window.CROW_CONFIG||{};
  }
  if(!window.supabase||typeof window.supabase.createClient!=="function"){
    await loadScript(supabaseUrl,"crowrules-presence-supabase");
  }
  cfg=window.CROW_CONFIG||cfg;
  if(!window.supabase||typeof window.supabase.createClient!=="function"||!cfg.supabaseUrl||!cfg.supabaseKey){
    throw new Error("Supabase client or public configuration is unavailable");
  }
  var path=(location.pathname||"/").toLowerCase();
  var isLaunch=path.indexOf("/pre-launch")!==-1||path.endsWith("/launch.html")||path==="/launch.html";
  var page=path.slice(-160);
  var client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  var key=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
  var channel=client.channel("crowrules-podcasting-online-v1",{config:{presence:{key:key}}});
  var currentUser=null;
  var payload={session_id:key,visitor_key:key,area:isLaunch?"launch":"site",page:page,role:"visitor",online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};
  var stopped=false,heartbeat=null,authSubscription=null,tracking=false;
  function updateRole(session){
    currentUser=session&&session.user||null;
    payload.role=roleFromUser(currentUser);
    if(!currentUser)return Promise.resolve();
    return client.from("members").select("id,role").eq("user_id",currentUser.id).maybeSingle().then(async function(m){
      if(!m.data)return;
      var roles=[m.data.role].filter(Boolean).map(function(x){return String(x).toLowerCase()});
      try{
        var result=await client.from("member_roles").select("role").eq("member_id",m.data.id);
        (result.data||[]).forEach(function(x){roles.push(String(x.role||"").toLowerCase())});
      }catch(e){}
      if(roles.some(function(x){return x.indexOf("creator")!==-1||x==="host"||x==="podcaster"}))payload.role="creator";
      else if(roles.some(function(x){return x.indexOf("admin")!==-1}))payload.role="admin";
      else payload.role="listener";
    }).catch(function(e){console.debug("[CrowRules presence] role lookup unavailable",e&&e.message)});
  }
  function countsFromState(){
    var state=channel.presenceState()||{},counts={all:0,listener:0,creator:0,guest:0,launch:0,site:0},seen={};
    Object.keys(state).forEach(function(k){(state[k]||[]).forEach(function(p){
      if(!p)return;
      var id=String(p.session_id||p.visitor_key||k);
      if(seen[id])return;seen[id]=true;counts.all++;
      var role=String(p.role||"visitor").toLowerCase(),area=String(p.area||"site").toLowerCase(),pg=String(p.page||"").toLowerCase();
      if(role==="listener"||role==="user")counts.listener++;
      if(role==="creator"||role==="host"||role==="podcaster")counts.creator++;
      if(role==="visitor"||role==="guest")counts.guest++;
      if(area==="launch"||pg.indexOf("pre-launch")!==-1||pg.endsWith("launch.html"))counts.launch++;
      if(area==="site")counts.site++;
    })});
    emit("crowrules:online",counts);
    return counts;
  }
  async function track(){
    if(stopped||tracking||document.visibilityState==="hidden"||channel.state!=="joined")return;
    tracking=true;
    payload.online_at=new Date().toISOString();payload.last_seen_at=payload.online_at;
    try{var status=await channel.track(payload);if(status&&status==="error")throw new Error("Supabase rejected presence tracking");countsFromState()}
    catch(e){emit("crowrules:online-error",{message:String(e&&e.message||e),status:channel.state});}
    finally{tracking=false}
  }
  channel.on("presence",{event:"sync"},countsFromState)
    .on("presence",{event:"join"},countsFromState)
    .on("presence",{event:"leave"},countsFromState);
  channel.subscribe(async function(status){
    emit("crowrules:online-status",{status:status});
    if(status==="SUBSCRIBED"){
      try{var session=await client.auth.getSession();await updateRole(session&&session.data&&session.data.session)}catch(e){}
      await track();
      if(!heartbeat)heartbeat=setInterval(track,30000);
    }
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")emit("crowrules:online-error",{message:"Presence channel "+status,status:status});
  });
  var authResult=client.auth.onAuthStateChange(function(event,session){
    Promise.resolve().then(async function(){await updateRole(session);await track()});
  });
  authSubscription=authResult&&authResult.data&&authResult.data.subscription;
  function leave(){
    if(stopped)return;stopped=true;
    if(heartbeat)clearInterval(heartbeat);
    try{if(authSubscription)authSubscription.unsubscribe()}catch(e){}
    try{channel.untrack()}catch(e){}
    try{client.removeChannel(channel)}catch(e){}
    try{client.auth.signOut({scope:"local"})}catch(e){}
  }
  window.addEventListener("pagehide",leave,{once:true});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")track()});
  window.CrowRulesOnline={channel:channel,client:client,getCounts:countsFromState,stop:leave};
  emit("crowrules:online-status",{status:"INITIALIZED"});
}
start().catch(function(e){
  console.warn("[CrowRules presence] tracker initialization failed",e);
  emit("crowrules:online-status",{status:"ERROR",message:String(e&&e.message||e)});
  emit("crowrules:online-error",{message:String(e&&e.message||e)});
}).finally(function(){window.__crowRulesPresenceBooting=false});
})();