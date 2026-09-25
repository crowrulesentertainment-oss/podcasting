(()=>{
  const nav=document.querySelector("[data-nav]");
  if(nav){
    nav.innerHTML='<header class="site-nav"><div class="wrap nav-inner"><a class="brand" href="home.html">CROW<b>RULES</b> PODCASTING</a><button class="nav-toggle" id="navToggle" aria-label="Open navigation" aria-expanded="false">☰</button><nav class="nav-links" id="navLinks"><a href="discover.html">Discover</a><a href="podcasts.html">Podcasts</a><a href="search.html">Search</a><a href="library.html">Library</a><a href="creator-dashboard.html">Creator</a><a href="creator-intelligence.html">Intelligence</a><a href="creator-goals.html">Goals</a><a class="nav-activity" href="creator-activity.html">Activity <span id="navAlertBadge" class="nav-badge" hidden>0</span></a><a href="analytics.html">Analytics</a><a href="release-calendar.html">Calendar</a><a href="distribution.html">Distribution</a><a href="membership.html">Membership</a><a href="account.html">Account</a></nav><span class="nav-user" id="navUser">Guest</span></div></header>';
    const toggle=document.getElementById("navToggle"),links=document.getElementById("navLinks");
    if(toggle&&links){
      toggle.addEventListener("click",()=>{const open=links.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));toggle.textContent=open?"✕":"☰"});
      links.addEventListener("click",e=>{if(e.target.closest("a")){links.classList.remove("open");toggle.setAttribute("aria-expanded","false");toggle.textContent="☰"}})
    }
  }
  const start=()=>{
    if(!window.CROW_APP)return;
    CROW_APP.init().then(()=>setupActivityBadge());
  };
  const setupActivityBadge=async()=>{
    const sb=window.CROW_SUPABASE,user=window.__CROW_USER,badge=document.getElementById("navAlertBadge");
    if(!sb||!user||!badge)return;
    const refresh=async()=>{
      const r=await sb.from("cr_creator_alerts").select("id",{count:"exact",head:true}).eq("creator_id",user.id).is("read_at",null);
      const n=Number(r.count||0);
      badge.textContent=n>99?"99+":String(n);
      badge.hidden=n<1;
    };
    await refresh();
    if(window.__CROW_ACTIVITY_CHANNEL)sb.removeChannel(window.__CROW_ACTIVITY_CHANNEL);
    window.__CROW_ACTIVITY_CHANNEL=sb.channel("creator-activity-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"cr_creator_alerts",filter:"creator_id=eq."+user.id},()=>refresh())
      .subscribe();
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
  };
  const s=document.createElement("script");
  s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload=start;
  document.head.appendChild(s);
})();