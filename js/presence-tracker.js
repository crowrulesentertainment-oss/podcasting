/* CrowRules Podcasting shared live-presence publisher.
   Keep the channel name in sync with admin.html: crowrules-podcasting-online-v1. */
(function(){
  "use strict";
  if(window.__CROW_PRESENCE_STARTED) return;
  window.__CROW_PRESENCE_STARTED=true;
  const cfg=window.CROW_CONFIG||window.CROW_CONFIG||{};
  const api=window.supabase;
  if(!api||!api.createClient||!cfg.supabaseUrl||!cfg.supabaseKey) {
    console.warn("[CrowRules presence] Supabase client/config unavailable on this page.");
    return;
  }
  const client=api.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const path=(location.pathname||"/").toLowerCase();
  const area=(path.includes("pre-launch")||path.endsWith("/launch.html")||path==="/launch.html")?"launch":
    (path.endsWith("/home.html")||path==="/"||path.endsWith("/index.html"))?"site":"site";
  const sessionId="crp-"+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
  let channel=null, stopped=false, refreshTimer=null;
  const page=(path.split("/").pop()||"home.html").slice(0,120);
  async function identify(){
    let role="visitor",userId=null;
    try{
      const {data,error}=await client.auth.getUser();
      if(!error&&data&&data.user){
        userId=data.user.id;
        role="listener";
        const member=await client.from("members").select("id,role").eq("user_id",userId).maybeSingle();
        if(member.data){
          const roles=[member.data.role].filter(Boolean).map(v=>String(v).toLowerCase());
          const extra=await client.from("member_roles").select("role").eq("member_id",member.data.id);
          (extra.data||[]).forEach(x=>roles.push(String(x.role||"").toLowerCase()));
          if(roles.some(v=>v.includes("creator")||v==="host")) role="creator";
          else if(roles.some(v=>v.includes("admin"))) role="admin";
          else role="listener";
        }
      }
    }catch(e){console.debug("[CrowRules presence] role lookup skipped",e&&e.message)}
    return {role,userId};
  }
  async function start(){
    if(stopped||document.visibilityState==="prerender") return;
    const who=await identify();
    if(stopped)return;
    channel=client.channel("crowrules-podcasting-online-v1");
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"){
        const payload={session_id:sessionId,role:who.role,area,page,online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};
        if(who.userId) payload.user_id=who.userId;
        try{await channel.track(payload)}catch(e){console.warn("[CrowRules presence] unable to publish session",e)}
        if(refreshTimer)clearInterval(refreshTimer);
        refreshTimer=setInterval(async()=>{
          if(stopped||!channel)return;
          try{await channel.track({...payload,online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()})}catch(e){console.debug("[CrowRules presence] heartbeat failed",e&&e.message)}
        },25000);
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
        console.warn("[CrowRules presence] channel status:",status);
      }
    });
  }
  function stop(){
    stopped=true;
    if(refreshTimer)clearInterval(refreshTimer);
    if(channel)client.removeChannel(channel);
  }
  window.addEventListener("pagehide",stop,{once:true});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&!stopped&&channel){const payload={session_id:sessionId,area,page,online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};channel.track(payload).catch(()=>{})}});
  start();
})();