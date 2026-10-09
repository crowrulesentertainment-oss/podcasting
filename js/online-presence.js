(function(){
"use strict";
try {
  var cfg=window.CROW_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseKey)return;
  var path=location.pathname.toLowerCase();
  var area=path.indexOf("/creator/")>=0?"creator":(path.indexOf("/listener/")>=0?"listener":(path.indexOf("launch")>=0||path.indexOf("signup")>=0?"launch":"site"));
  var client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  var key=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
  var channel=client.channel("crowrules-podcasting-online-v1",{config:{presence:{key:key}}});
  var payload={area:area,page:path.slice(-80),online_at:new Date().toISOString(),visitor_key:key};
  channel.on("presence",{event:"sync"},function(){
    var state=channel.presenceState(),counts={all:0,listener:0,creator:0,launch:0,site:0};
    Object.keys(state||{}).forEach(function(k){(state[k]||[]).forEach(function(p){
      if(!p||!p.area)return;counts.all++;if(Object.prototype.hasOwnProperty.call(counts,p.area))counts[p.area]++;
    })});
    window.dispatchEvent(new CustomEvent("crowrules:online",{detail:counts}));
  });
  channel.subscribe(function(status){if(status==="SUBSCRIBED")channel.track(payload).catch(function(){});});
  function leave(){try{channel.untrack()}catch(e){}}
  window.addEventListener("pagehide",leave,{once:true});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"){payload.online_at=new Date().toISOString();channel.track(payload).catch(function(){})}});
  window.CrowRulesOnline={channel:channel,client:client};
} catch(e) { /* Presence is an optional enhancement and must not break the page. */ }
})();