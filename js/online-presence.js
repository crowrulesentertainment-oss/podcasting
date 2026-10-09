(function(){
"use strict";
try {
  var cfg=window.CROW_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseKey)return;
  var path=location.pathname.toLowerCase();
  var client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  var key=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
  var channel=client.channel("crowrules-podcasting-online-v2",{config:{presence:{key:key}}});
  var payload={area:"guest",page:path.slice(-80),online_at:new Date().toISOString(),visitor_key:key};
  function roleFromUser(user){
    if(!user)return "guest";
    var meta=user.user_metadata||{};
    var role=String(meta.podcast_role||meta.signup_role||meta.role||"").toLowerCase();
    return role==="creator"||role==="podcaster"?"creator":"listener";
  }
  function publishCounts(){
    var state=channel.presenceState(),counts={all:0,listener:0,creator:0,guest:0};
    Object.keys(state||{}).forEach(function(k){(state[k]||[]).forEach(function(p){
      if(!p||!p.area)return;
      counts.all++;
      if(Object.prototype.hasOwnProperty.call(counts,p.area))counts[p.area]++;
    })});
    window.dispatchEvent(new CustomEvent("crowrules:online",{detail:counts}));
  }
  function trackCurrentSession(){
    if(channel.state!=="joined")return;
    channel.track(payload).then(function(){publishCounts()}).catch(function(error){
      window.dispatchEvent(new CustomEvent("crowrules:online-error",{detail:{message:String(error&&error.message||error),status:channel.state}}));
    });
  }
  function applySession(session){
    payload.area=roleFromUser(session&&session.user);
    payload.online_at=new Date().toISOString();
    trackCurrentSession();
  }
  channel.on("presence",{event:"sync"},publishCounts);
  channel.subscribe(function(status){
    window.dispatchEvent(new CustomEvent("crowrules:online-status",{detail:{status:status}}));
    if(status==="SUBSCRIBED"){
      client.auth.getSession().then(function(result){applySession(result&&result.data&&result.data.session)}).catch(function(){trackCurrentSession()});
      trackCurrentSession();
    }
  });
  var authListener=client.auth.onAuthStateChange(function(event,session){
    Promise.resolve().then(function(){applySession(session)});
  });
  function leave(){try{channel.untrack();if(authListener&&authListener.data&&authListener.data.subscription)authListener.data.subscription.unsubscribe()}catch(e){}}
  window.addEventListener("pagehide",leave,{once:true});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"){payload.online_at=new Date().toISOString();channel.track(payload).catch(function(){})}});
  window.CrowRulesOnline={channel:channel,client:client};
} catch(e) { /* Presence is optional and must not break the page. */ }
})();