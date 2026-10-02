(()=>{
  const nav=document.querySelector("[data-nav]");
  if(nav){
    nav.innerHTML='<header class="site-nav"><div class="wrap nav-inner"><a class="brand" href="home.html">CROW<b>RULES</b> PODCASTING</a><button class="nav-toggle" id="navToggle" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="nav-links" id="navLinks">\
<div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Explore <span>⌄</span></button><div class="nav-dropdown"><a href="discover.html">Discover</a><a href="podcasts.html">All Podcasts</a><a href="episodes.html">Episodes</a><a href="search.html">Search</a><a href="library.html">Library</a><a href="members-podcaster.html">Podcasters</a><a href="member-listener.html">Listeners</a></div></div>\
<div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Creator <span>⌄</span></button><div class="nav-dropdown"><a href="creator-center.html">Command Center</a><a href="creator-dashboard.html">Creator Studio</a><a href="create-podcast.html">Create Podcast</a><a href="create-episode.html">Create Episode</a><a href="creator-actions.html">Actions</a><a href="creator-outcomes.html">Outcomes</a><a href="creator-learning.html">Learning</a><a href="creator-goals.html">Goals</a><a href="creator-automation.html">Automation</a><a href="creator-activity.html">Activity <span id="navAlertBadge" class="nav-badge" hidden>0</span></a><a href="creator-analytics.html">Analytics</a><a href="creator-audience.html">Audience</a><a href="creator-monetization.html">Monetization</a><a href="payouts.html">Payouts</a><a href="creator-settings.html">Settings</a></div></div>\
<div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Intelligence <span>⌄</span></button><div class="nav-dropdown"><a href="creator-intelligence.html">Creator Intelligence</a><a href="creator-recommendations.html">Adaptive Recommendations</a><a href="creator-analytics.html">Creator Analytics</a><a href="analytics.html">Platform Analytics</a></div></div>\
<div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Publishing <span>⌄</span></button><div class="nav-dropdown"><a href="publishing-pipeline.html">Pipeline</a><a href="release-calendar.html">Calendar</a><a href="distribution.html">Distribution</a></div></div>\
<div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Account <span>⌄</span></button><div class="nav-dropdown"><a href="member-profile.html">My Profile</a><a href="membership.html">Membership</a><a href="account.html">Account</a></div></div>\
</nav><span class="nav-user" id="navUser">Connecting…</span></div></header>';
    const toggle=document.getElementById("navToggle"),links=document.getElementById("navLinks");
    const closeMenus=()=>document.querySelectorAll(".nav-menu.open").forEach(m=>{m.classList.remove("open");m.querySelector(".nav-menu-btn")?.setAttribute("aria-expanded","false")});
    document.querySelectorAll(".nav-menu-btn").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();const menu=btn.parentElement,open=menu.classList.toggle("open");btn.setAttribute("aria-expanded",String(open));document.querySelectorAll(".nav-menu.open").forEach(m=>{if(m!==menu){m.classList.remove("open");m.querySelector(".nav-menu-btn")?.setAttribute("aria-expanded","false")}})}));
    document.addEventListener("click",e=>{if(!e.target.closest(".nav-menu"))closeMenus()});
    if(toggle&&links){toggle.addEventListener("click",()=>{const open=links.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));toggle.textContent=open?"✕":"☰"});links.addEventListener("click",e=>{if(e.target.closest(".nav-dropdown a")){closeMenus();links.classList.remove("open");toggle.setAttribute("aria-expanded","false");toggle.textContent="☰"}})}
  }

  const ensureClient=()=>{
    if(window.CROW_SUPABASE)return window.CROW_SUPABASE;
    const cfg=window.CROW_CONFIG||{};
    if(!window.supabase?.createClient)throw new Error("Supabase client library is unavailable.");
    if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error("CrowRules Supabase configuration is missing.");
    window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    return window.CROW_SUPABASE;
  };

  const withTimeout=async(promise,ms)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error("Supabase authentication timed out.")),ms))])}finally{clearTimeout(timer)}};
  const connectSupabase=async()=>{
    const sb=ensureClient();
    let session=null;
    try{const r=await withTimeout(sb.auth.getSession(),6000);session=r.data?.session||null}catch(e){console.warn("CrowRules getSession:",e.message)}
    window.__CROW_USER=session?.user||null;
    const n=document.getElementById("navUser");if(n)n.textContent=window.__CROW_USER?(window.__CROW_USER.user_metadata?.full_name||window.__CROW_USER.email||"Member"):"Guest";
    window.__CROW_AUTH_READY=true;
    window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user:window.__CROW_USER,supabase:sb}}));
    return sb;
  };

  const start=async()=>{
    try{
      await connectSupabase();
      if(window.CROW_APP?.init){try{await withTimeout(CROW_APP.init(),5000)}catch(e){console.warn("CrowRules app init:",e.message)}}
      await setupPresence();
      await setupActivityBadge();
      setTimeout(()=>window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user:window.__CROW_USER,supabase:window.CROW_SUPABASE}})),0);
    }catch(error){
      console.error("CrowRules Supabase connection failed:",error);
      const n=document.getElementById("navUser");if(n)n.textContent="Connection issue";
      document.dispatchEvent(new CustomEvent("crow:auth-error",{detail:{message:error.message||"Supabase connection failed."}}));
    }
  };

  const setupPresence=async()=>{const sb=window.CROW_SUPABASE;if(!sb)return;if(window.__CROW_PRESENCE_CHANNEL)return;const key=window.__CROW_USER?.id||("guest-"+crypto.randomUUID());const ch=sb.channel("podcasting-online",{config:{presence:{key}}});window.__CROW_PRESENCE_CHANNEL=ch;let heartbeat=null;const track=async()=>{try{if(document.hidden)return;await ch.track({user_id:window.__CROW_USER?.id||null,display_name:window.__CROW_USER?.user_metadata?.full_name||"Guest",page:document.title||"Podcasting",online_at:new Date().toISOString(),last_seen_at:new Date().toISOString()})}catch(e){console.warn("CrowRules presence:",e.message)}};ch.subscribe(async status=>{if(status==="SUBSCRIBED"){await track();if(!heartbeat)heartbeat=setInterval(track,20000)}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){console.warn("CrowRules presence channel:",status)}});document.addEventListener("visibilitychange",()=>{if(!document.hidden)track()});window.addEventListener("beforeunload",()=>{if(heartbeat)clearInterval(heartbeat);try{ch.untrack()}catch(_){}},{once:true})};

const setupActivityBadge=async()=>{
    const sb=window.CROW_SUPABASE,user=window.__CROW_USER,badge=document.getElementById("navAlertBadge");
    if(!sb||!user||!badge)return;
    const refresh=async()=>{const r=await sb.from("cr_creator_alerts").select("id",{count:"exact",head:true}).eq("creator_id",user.id).is("read_at",null).is("muted_at",null);if(r.error){console.warn("Creator alerts:",r.error.message);return}const n=Number(r.count||0);badge.textContent=n>99?"99+":String(n);badge.hidden=n<1};
    await refresh();
    if(window.__CROW_ACTIVITY_CHANNEL)sb.removeChannel(window.__CROW_ACTIVITY_CHANNEL);
    window.__CROW_ACTIVITY_CHANNEL=sb.channel("creator-activity-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"cr_creator_alerts",filter:"creator_id=eq."+user.id},()=>refresh()).subscribe();
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
  };

  const bootstrap=()=>{
    try{ensureClient();start()}catch(e){
      const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=start;s.onerror=()=>document.dispatchEvent(new CustomEvent("crow:auth-error",{detail:{message:"Supabase client failed to load."}}));document.head.appendChild(s);
    }
  };
  if(window.supabase)bootstrap();else{
    const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=bootstrap;s.onerror=()=>document.dispatchEvent(new CustomEvent("crow:auth-error",{detail:{message:"Supabase client failed to load."}}));document.head.appendChild(s)
  }
})();