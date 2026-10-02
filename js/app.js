(()=>{
  "use strict";

  const VERSION="7.0";
  const BASE="https://crowrulesentertainment-oss.github.io/podcasting";

  const NAV_HTML=`<header class="site-nav"><div class="wrap nav-inner">
    <a class="brand" href="${BASE}/home.html">CROW<b>RULES</b> PODCASTING</a>
    <button class="nav-toggle" id="navToggle" aria-label="Open navigation" aria-expanded="false">☰</button>
    <nav class="nav-links" id="navLinks" aria-label="Podcasting navigation">
      <a href="${BASE}/home.html">Home</a>
      <div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Explore <span>⌄</span></button><div class="nav-dropdown">
        <a href="${BASE}/discover.html">Discover</a><a href="${BASE}/podcasts.html">All Podcasts</a><a href="${BASE}/episodes.html">Episodes</a><a href="${BASE}/search.html">Search</a><a href="${BASE}/library.html">Library</a><a href="${BASE}/members-podcaster.html">Podcasters</a><a href="${BASE}/member-listener.html">Listeners</a>
      </div></div>
      <div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Creator <span>⌄</span></button><div class="nav-dropdown">
        <a href="${BASE}/creator-center.html">Command Center</a><a href="${BASE}/creator-dashboard.html">Creator Studio</a><a href="${BASE}/create-podcast.html">Create Podcast</a><a href="${BASE}/create-episode.html">Create Episode</a><a href="${BASE}/creator-actions.html">Actions</a><a href="${BASE}/creator-outcomes.html">Outcomes</a><a href="${BASE}/creator-learning.html">Learning</a><a href="${BASE}/creator-goals.html">Goals</a><a href="${BASE}/creator-automation.html">Automation</a><a href="${BASE}/creator-activity.html">Activity <span id="navAlertBadge" class="nav-badge" hidden>0</span></a><a href="${BASE}/creator-analytics.html">Analytics</a><a href="${BASE}/creator-audience.html">Audience</a><a href="${BASE}/creator-monetization.html">Monetization</a><a href="${BASE}/payouts.html">Payouts</a><a href="${BASE}/creator-settings.html">Settings</a>
      </div></div>
      <div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Intelligence <span>⌄</span></button><div class="nav-dropdown">
        <a href="${BASE}/creator-intelligence.html">Creator Intelligence</a><a href="${BASE}/creator-recommendations.html">Adaptive Recommendations</a><a href="${BASE}/creator-analytics.html">Creator Analytics</a><a href="${BASE}/analytics.html">Platform Analytics</a>
      </div></div>
      <div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Publishing <span>⌄</span></button><div class="nav-dropdown">
        <a href="${BASE}/publishing-pipeline.html">Pipeline</a><a href="${BASE}/release-calendar.html">Calendar</a><a href="${BASE}/distribution.html">Distribution</a>
      </div></div>
      <div class="nav-menu"><button class="nav-menu-btn" type="button" aria-expanded="false">Account <span>⌄</span></button><div class="nav-dropdown">
        <a href="${BASE}/member-profile.html">My Profile</a><a href="${BASE}/membership.html">Membership</a><a href="${BASE}/notifications.html">Notifications</a><a href="${BASE}/account.html">Account</a>
      </div></div>
    </nav>
    <span class="nav-user" id="navUser">Connecting…</span>
  </div></header>`;

  const ensureStyles=()=>{
    if(document.querySelector('link[data-crowrules-podcasting-css]'))return;
    const existing=[...document.querySelectorAll('link[rel="stylesheet"]')].some(l=>/podcasting\.css(?:\?|$)/.test(l.href||""));
    if(existing)return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=`${BASE}/css/podcasting.css`;
    link.dataset.crowrulesPodcastingCss="1";
    document.head.appendChild(link);
  };

  const ensureNav=()=>{
    if(!document.body)return;
    ensureStyles();
    let nav=document.querySelector("[data-nav]");
    if(!nav){
      nav=document.createElement("div");
      nav.setAttribute("data-nav","");
      document.body.insertBefore(nav,document.body.firstChild);
    }
    nav.innerHTML=NAV_HTML;

    const toggle=document.getElementById("navToggle");
    const links=document.getElementById("navLinks");
    const closeMenus=()=>document.querySelectorAll(".nav-menu.open").forEach(menu=>{
      menu.classList.remove("open");
      menu.querySelector(".nav-menu-btn")?.setAttribute("aria-expanded","false");
    });

    document.querySelectorAll(".nav-menu-btn").forEach(btn=>btn.addEventListener("click",event=>{
      event.stopPropagation();
      const menu=btn.parentElement;
      const open=menu.classList.toggle("open");
      btn.setAttribute("aria-expanded",String(open));
      document.querySelectorAll(".nav-menu.open").forEach(other=>{
        if(other!==menu){
          other.classList.remove("open");
          other.querySelector(".nav-menu-btn")?.setAttribute("aria-expanded","false");
        }
      });
    }));

    document.addEventListener("click",event=>{
      if(!event.target.closest(".nav-menu"))closeMenus();
    },{passive:true});

    toggle?.addEventListener("click",()=>{
      const open=links?.classList.toggle("open")||false;
      toggle.setAttribute("aria-expanded",String(open));
      toggle.textContent=open?"✕":"☰";
    });
  };

  const ensureClient=()=>{
    if(window.CROW_SUPABASE)return window.CROW_SUPABASE;
    const cfg=window.CROW_CONFIG||{};
    if(!window.supabase?.createClient)throw new Error("Supabase client library is unavailable.");
    if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error("CrowRules Supabase configuration is missing.");
    window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
    });
    return window.CROW_SUPABASE;
  };

  const withTimeout=async(promise,ms,message)=>{
    let timer;
    try{
      return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error(message||"Supabase request timed out.")),ms))]);
    }finally{clearTimeout(timer)}
  };

  const setUser=user=>{
    window.__CROW_USER=user||null;
    window.__CROW_AUTH_READY=true;
    const n=document.getElementById("navUser");
    if(n)n.textContent=user?(user.user_metadata?.full_name||user.user_metadata?.name||user.email||"Member"):"Guest";
    window.dispatchEvent(new CustomEvent("crow:auth-changed",{detail:{user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));
    window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));
  };

  const connect=async()=>{
    const sb=ensureClient();
    try{
      const r=await withTimeout(sb.auth.getSession(),7000,"Supabase authentication timed out.");
      setUser(r.data?.session?.user||null);
    }catch(error){
      console.warn("CrowRules getSession:",error?.message||error);
      setUser(null);
    }
    return sb;
  };

  const authListener=sb=>{
    if(window.__CROW_AUTH_SUB)return;
    const {data}=sb.auth.onAuthStateChange((event,session)=>{
      setUser(session?.user||null);
      if(event==="SIGNED_OUT"){
        try{
          if(window.__CROW_PRESENCE_CHANNEL)sb.removeChannel(window.__CROW_PRESENCE_CHANNEL);
          if(window.__CROW_ACTIVITY_CHANNEL)sb.removeChannel(window.__CROW_ACTIVITY_CHANNEL);
        }catch(_){ }
        window.__CROW_PRESENCE_CHANNEL=null;
        window.__CROW_ACTIVITY_CHANNEL=null;
      }
    });
    window.__CROW_AUTH_SUB=data?.subscription||null;
  };

  const presence=async()=>{
    const sb=window.CROW_SUPABASE;
    if(!sb||window.__CROW_PRESENCE_CHANNEL)return;
    const key=window.__CROW_USER?.id||(`guest-${crypto.randomUUID?.()||Date.now()}`);
    const channel=sb.channel("podcasting-online",{config:{presence:{key}}});
    window.__CROW_PRESENCE_CHANNEL=channel;
    let heartbeat=null;
    const track=async()=>{
      try{
        if(document.hidden)return;
        await channel.track({
          user_id:window.__CROW_USER?.id||null,
          display_name:window.__CROW_USER?.user_metadata?.full_name||window.__CROW_USER?.email||"Guest",
          page:document.title||"Podcasting",
          last_seen_at:new Date().toISOString()
        });
      }catch(error){console.warn("CrowRules presence:",error?.message||error)}
    };
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"){
        await track();
        if(!heartbeat)heartbeat=setInterval(track,30000);
      }else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
        clearInterval(heartbeat);heartbeat=null;
      }
    });
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)track()});
    window.addEventListener("beforeunload",()=>{
      clearInterval(heartbeat);
      try{channel.untrack()}catch(_){ }
    },{once:true});
  };

  const activity=async()=>{
    const sb=window.CROW_SUPABASE;
    const user=window.__CROW_USER;
    const badge=document.getElementById("navAlertBadge");
    if(!sb||!user||!badge)return;

    const refresh=async()=>{
      try{
        const r=await sb.from("cr_creator_alerts").select("id",{count:"exact",head:true}).eq("creator_id",user.id).is("read_at",null).is("muted_at",null);
        if(r.error)return;
        const n=Number(r.count||0);
        badge.textContent=n>99?"99+":String(n);
        badge.hidden=n<1;
      }catch(error){console.warn("CrowRules activity:",error?.message||error)}
    };

    await refresh();
    window.__CROW_ACTIVITY_CHANNEL=sb.channel(`creator-activity-${user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"cr_creator_alerts",filter:`creator_id=eq.${user.id}`},refresh)
      .subscribe();
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
  };

  const bootstrap=async()=>{
    ensureNav();
    const sb=await connect();
    authListener(sb);
    await presence();
    await activity();
    window.__CROW_APP_VERSION=VERSION;
    return sb;
  };

  const start=async()=>{
    try{
      ensureNav();
      if(!window.supabase?.createClient){
        await new Promise((resolve,reject)=>{
          const existing=document.querySelector('script[data-crowrules-supabase]');
          if(existing){existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",()=>reject(new Error("Supabase client failed to load.")),{once:true});return;}
          const script=document.createElement("script");
          script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          script.dataset.crowrulesSupabase="1";
          script.onload=resolve;
          script.onerror=()=>reject(new Error("Supabase client failed to load."));
          document.head.appendChild(script);
        });
      }
      return await bootstrap();
    }catch(error){
      console.error("CrowRules Podcasting bootstrap failed:",error);
      window.__CROW_APP_ERROR=error;
      setUser(null);
      return null;
    }
  };

  window.CROW_SUPABASE_READY=start();
  window.CROW_APP_READY=window.CROW_SUPABASE_READY;

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensureNav,{once:true});
  else ensureNav();
})();
