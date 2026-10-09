(function(){
"use strict";
try{
  var cfg=window.CROW_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseKey)return;
  if(window.CrowRulesOnline)return;
  var path=(location.pathname||"/").toLowerCase();
  var isLaunch=path.indexOf("pre-launch")!==-1||path.endsWith("/launch.html")||path==="/launch.html";
  var page=path.slice(-120);
  var client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  var key=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
  var channel=client.channel("crowrules-podcasting-online-v1",{config:{presence:{key:key}}});
  var currentUser=null;
  var payload={session_id:key,visitor_key:key,area:isLaunch?"launch":"site",page:page,role:"visitor",online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};
  function roleFromUser(user){
    if(!user)return "visitor";
    var meta=user.user_metadata||{};
    var role=String(meta.podcast_role||meta.signup_role||meta.role||"").toLowerCase();
    if(role==="creator"||role==="podcaster"||role==="host")return "creator";
    return "listener";
  }
  async function resolveRole(session){
    currentUser=session&&session.user||null;
    payload.role=roleFromUser(currentUser);
    if(!currentUser)return;
    try{
      var m=await client.from("members").select("id,role").eq("user_id",currentUser.id).maybeSingle();
      if(m.data){
        var roles=[m.data.role].filter(Boolean).map(function(x){return String(x).toLowerCase()});
        var r=await client.from("member_roles").select("role").eq("member_id",m.data.id);
        (r.data||[]).forEach(function(x){roles.push(String(x.role||"").toLowerCase())});
        if(roles.some(function(x){return x.indexOf("creator")!==-1||x==="host"||x==="podcaster"}))payload.role="creator";
        else if(roles.some(function(x){return x.indexOf("admin")!==-1}))payload.role="admin";
        else payload.role="listener";
      }
    }catch(e){console.debug("[CrowRules presence] role lookup unavailable",e&&e.message)}
  }
  function publishCounts(){
    var state=channel.presenceState()||{},counts={all:0,listener:0,creator:0,guest:0,launch:0,site:0},seen={};
    Object.keys(state).forEach(function(k){(state[k]||[]).forEach(function(p){
      if(!p)return;
      var id=String(p.session_id||p.visitor_key||k);
      if(seen[id])return;seen[id]=true;counts.all++;
      var role=String(p.role||"visitor").toLowerCase(),area=String(p.area||"site").toLowerCase();
      if(role==="listener"||role==="user")counts.listener++;
      if(role==="creator"||role==="host"||role==="podcaster")counts.creator++;
      if(role==="visitor"||role==="guest")counts.guest++;
      if(area==="launch"||String(p.page||"").indexOf("pre-launch")!==-1||String(p.page||"").endsWith("launch.html"))counts.launch++;
      if(area==="site")counts.site++;
    })});
    window.dispatchEvent(new CustomEvent("crowrules:online",{detail:counts}));
  }
  async function track(){
    if(document.visibilityState==="hidden")return;
    payload.online_at=new Date().toISOString();payload.last_seen_at=payload.online_at;
    try{await channel.track(payload);publishCounts()}catch(e){
      window.dispatchEvent(new CustomEvent("crowrules:online-error",{detail:{message:String(e&&e.message||e),status:channel.state}}));
    }
  }
  channel.on("presence",{event:"sync"},publishCounts).on("presence",{event:"join"},publishCounts).on("presence",{event:"leave"},publishCounts);
  channel.subscribe(async function(status){
    window.dispatchEvent(new CustomEvent("crowrules:online-status",{detail:{status:status}}));
    if(status==="SUBSCRIBED"){
      try{var result=await client.auth.getSession();await resolveRole(result&&result.data&&result.data.session)}catch(e){}
      await track();
    }
  });
  var authListener=client.auth.onAuthStateChange(function(event,session){
    Promise.resolve().then(async function(){await resolveRole(session);await track()});
  });
  var heartbeat=setInterval(track,25000);
  function leave(){
    clearInterval(heartbeat);
    try{channel.untrack();if(authListener&&authListener.data&&authListener.data.subscription)authListener.data.subscription.unsubscribe();client.removeChannel(channel)}catch(e){}
  }
  window.addEventListener("pagehide",leave,{once:true});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")track()});
  window.CrowRulesOnline={channel:channel,client:client};
}catch(e){console.warn("[CrowRules presence] tracker initialization failed",e)}
})();