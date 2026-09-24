/* CrowRules Podcasting — Global Navigation 8.4 — Real-Time Identity Synchronization
   One shared navigation system.
   Live identity, membership/premium presence, notifications,
   creator state, cross-tab synchronization, and account command palette.
   Repository links intentionally excluded.
*/
(function(){
  "use strict";
  if(window.__CROWRULES_GLOBAL_NAV_84__) return;
  window.__CROWRULES_GLOBAL_NAV_84__=true;

  const VERSION="8.4";
  const CHANNEL_NAME="crowrules-podcasting-global-nav-84";
  const STORAGE_KEY="crowrules-podcasting-nav-84";
  const REFRESH_MS=15000;
  const NOTIFY_LIMIT=12;
  const nav=[
    ["home.html","Home",["index.html","home.html"],"home"],
    ["discover.html","Discover",["discover.html","search.html","categories.html"],"discover"],
    ["podcasts.html","Podcasts",["podcasts.html","podcast.html"],"listen"],
    ["episodes.html","Episodes",["episodes.html","episode.html"],"listen"],
    ["creators.html","Creators",["creators.html","creator.html"],"discover"],
    ["create-podcast.html","Create",["create-podcast.html"],"create"],
    ["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html"],"create"],
    ["membership.html","Membership",["membership.html","subscriptions.html"],"account"],
    ["premium-library.html","Premium",["premium-library.html","premium.html"],"account"],
    ["creator-monetization-hub.html","Monetization",["creator-monetization-hub.html","monetization.html"],"growth"],
    ["playback-security.html","Security",["playback-security.html","playback-devices.html"],"account"]
  ];
  const help=["help-center.html","help.html","support.html"];
  const accountAliases=["profile.html","account.html","account-center.html","account-settings.html"];

  const path=location.pathname;
  const hasFile=/\/[^/]+\.[^/]+$/.test(path);
  const rawParts=path.split("/").filter(Boolean);
  const current=(hasFile?(rawParts.pop()||"index.html"):"index.html").toLowerCase();
  const prefix=rawParts.length?"../".repeat(rawParts.length):"";
  const href=target=>prefix+target;
  const isCurrent=aliases=>aliases.includes(current);

  let db=null,user=null,realtimeChannel=null,authSubscription=null;
  let notifications=[],unreadCount=0,membership=null,premium=false,creator=false;
  let openPanel=null,refreshTimer=null,pollTimer=null,identityRequest=0,dependencyPromise=null;

  function loadScriptOnce(src,key){
    return new Promise((resolve,reject)=>{
      if(key && document.querySelector('script[data-cr-nav-dependency="'+key+'"]')){resolve();return}
      const s=document.createElement("script");s.src=src;s.defer=true;
      if(key)s.dataset.crNavDependency=key;
      s.onload=()=>resolve();s.onerror=()=>reject(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureDependencies(){
    if(dependencyPromise)return dependencyPromise;
    dependencyPromise=(async()=>{
      try{
        if(!window.CROWRULES_SUPABASE_URL||!window.CROWRULES_SUPABASE_PUBLISHABLE_KEY){
          await loadScriptOnce(href("js/config.js"),"config");
        }
        if(!window.supabase?.createClient){
          await loadScriptOnce("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2","supabase");
        }
        if(!window.CrowRulesMemberState && window.supabase?.createClient){
          try{await loadScriptOnce(href("js/member-state.js"),"member-state")}catch(_){}
        }
      }catch(_){}
    })();
    return dependencyPromise;
  }

  function getDb(){
    if(db)return db;
    if(window.CrowRulesMemberState?.client)return db=window.CrowRulesMemberState.client;
    if(window.supabaseClient)return db=window.supabaseClient;
    if(window.supabase&&window.CROWRULES_SUPABASE_URL&&window.CROWRULES_SUPABASE_PUBLISHABLE_KEY){
      try{db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY)}catch(_){}
    }
    return db;
  }
  function uid(){return user?.id||window.CrowRulesMemberState?.userId||null}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
  function relativeTime(v){
    const t=new Date(v).getTime();if(!Number.isFinite(t))return "";
    const s=Math.max(1,Math.floor((Date.now()-t)/1000));if(s<60)return"Just now";
    const m=Math.floor(s/60);if(m<60)return m+"m ago";
    const h=Math.floor(m/60);if(h<24)return h+"h ago";
    const d=Math.floor(h/24);if(d<7)return d+"d ago";
    return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(t));
  }
  function dispatch(type,detail={}){window.dispatchEvent(new CustomEvent("crowrules:global-nav",{detail:{type,...detail}}))}
  function broadcast(type,payload={}){
    const message={source:"crowrules-global-nav-84",type,payload,at:new Date().toISOString()};
    try{
      if("BroadcastChannel"in window){
        if(!window.__crowRulesGlobalNavChannel)window.__crowRulesGlobalNavChannel=new BroadcastChannel(CHANNEL_NAME);
        window.__crowRulesGlobalNavChannel.postMessage(message);
      }
    }catch(_){}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(message));localStorage.removeItem(STORAGE_KEY)}catch(_){}
  }

  function renderIdentity(){
    const profile=document.querySelector(".cr-global-identity");
    if(profile){
      profile.classList.toggle("is-authenticated",!!user);
      profile.classList.toggle("is-member",!!membership);
      profile.classList.toggle("is-premium",!!premium);
      profile.classList.toggle("is-creator",!!creator);
      if(user){
        const label=(user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split("@")[0]||"Member").trim();
        profile.innerHTML='<span class="cr-avatar" aria-hidden="true">'+escapeHtml(label.slice(0,1).toUpperCase())+'</span><span class="cr-account-label">'+escapeHtml(label)+'</span>';
        profile.setAttribute("aria-label","Open account for "+label);
        profile.title=label+(membership?" · Member":"")+(premium?" · Premium":"")+(creator?" · Creator":"");
      }else{
        profile.innerHTML='<span class="cr-avatar cr-avatar-guest" aria-hidden="true">CR</span><span class="cr-account-label">Sign In</span>';
        profile.setAttribute("aria-label","Sign in to CrowRules Podcasting");
        profile.title="Sign in";
      }
    }
    const status=document.querySelector(".cr-presence-status");
    if(status){
      status.textContent=user?(premium?"Premium":creator?"Creator":membership?"Member":"Signed in"):"Guest";
      status.classList.toggle("active",!!user);
    }
    const badge=document.querySelector(".cr-notification-badge");
    if(badge){badge.textContent=unreadCount>99?"99+":String(unreadCount);badge.hidden=unreadCount<1}
    dispatch("identity",{user,membership,premium,creator,unreadCount});
  }

  function notificationIcon(type){
    if(/premium|entitlement/i.test(type||""))return"✦";
    if(/membership|subscription/i.test(type||""))return"♢";
    if(/episode|podcast/i.test(type||""))return"▶";
    if(/follow|member/i.test(type||""))return"◎";
    return"•";
  }
  function buildNotificationCenter(){
    const panel=document.createElement("section");
    panel.className="cr-nav-popover cr-notification-center";
    panel.id="cr-notification-center";
    panel.setAttribute("aria-label","Notification center");
    panel.hidden=true;
    panel.innerHTML='<div class="cr-popover-head"><div><span class="cr-popover-kicker">LIVE CENTER</span><h2>Notifications</h2></div><button type="button" class="cr-icon-button cr-mark-all" aria-label="Mark all notifications as read" title="Mark all read">✓</button></div><div class="cr-notification-list" role="list"></div><div class="cr-popover-foot"><a href="'+href("notifications.html")+'">Open notification center</a><span class="cr-live-dot">LIVE</span></div>';
    document.body.appendChild(panel);
    panel.querySelector(".cr-mark-all").addEventListener("click",markAllRead);
    return panel;
  }
  function renderNotificationCenter(){
    const panel=document.querySelector(".cr-notification-center");if(!panel)return;
    const list=panel.querySelector(".cr-notification-list");
    if(!notifications.length){
      list.innerHTML='<div class="cr-notification-empty"><span>✦</span><strong>You’re all caught up.</strong><p>New follows, episodes, membership and premium events will appear here.</p></div>';
      return;
    }
    list.innerHTML=notifications.map(n=>'<button type="button" class="cr-notification-item '+(n.is_read?"":"unread")+'" data-notification-id="'+escapeHtml(n.id)+'"><span class="cr-notification-icon">'+notificationIcon(n.type)+'</span><span class="cr-notification-copy"><strong>'+escapeHtml(n.title||"CrowRules update")+'</strong><span>'+escapeHtml(n.body||"")+'</span><time>'+escapeHtml(relativeTime(n.created_at))+'</time></span>'+(!n.is_read?'<i class="cr-unread-dot" aria-label="Unread"></i>':"")+"</button>").join("");
    list.querySelectorAll("[data-notification-id]").forEach(b=>b.addEventListener("click",()=>markRead(b.dataset.notificationId)));
  }
  async function loadNotifications(){
    const client=getDb(),id=uid();
    if(!client||!id){
      notifications=[];unreadCount=0;renderNotificationCenter();renderIdentity();return;
    }
    const r=await client.from("podcast_notifications").select("id,user_id,type,title,body,is_read,created_at,podcast_id,episode_id,actor_user_id").eq("user_id",id).order("created_at",{ascending:false}).limit(NOTIFY_LIMIT);
    if(r.error)return;
    notifications=r.data||[];
    unreadCount=notifications.filter(n=>!n.is_read).length;
    renderNotificationCenter();renderIdentity();
  }
  async function markRead(id){
    const client=getDb(),owner=uid();if(!client||!owner||!id)return;
    const r=await client.from("podcast_notifications").update({is_read:true}).eq("id",id).eq("user_id",owner);
    if(r.error)return;
    notifications=notifications.map(n=>n.id===id?{...n,is_read:true}:n);
    unreadCount=notifications.filter(n=>!n.is_read).length;
    renderNotificationCenter();renderIdentity();
    broadcast("notification-read",{id});dispatch("notification-read",{id});
  }
  async function markAllRead(){
    const client=getDb(),owner=uid();if(!client||!owner||!unreadCount)return;
    const r=await client.from("podcast_notifications").update({is_read:true}).eq("user_id",owner).eq("is_read",false);
    if(r.error)return;
    notifications=notifications.map(n=>({...n,is_read:true}));
    unreadCount=0;renderNotificationCenter();renderIdentity();
    broadcast("notifications-read-all");dispatch("notifications-read-all");
  }
  function notifyLocal(n){
    if(!n?.id)return;
    if(!notifications.some(x=>x.id===n.id))notifications=[n,...notifications].slice(0,NOTIFY_LIMIT);
    unreadCount=notifications.filter(x=>!x.is_read).length;
    renderNotificationCenter();renderIdentity();dispatch("notification",{notification:n});
  }

  async function loadIdentity(){
    const client=getDb();if(!client)return;
    const request=++identityRequest;
    const auth=await client.auth.getUser();
    if(request!==identityRequest)return;
    user=auth.data?.user||null;
    if(!user){
      membership=null;premium=false;creator=false;notifications=[];unreadCount=0;
      renderIdentity();renderNotificationCenter();return;
    }
    const member=await client.from("members").select("id").eq("user_id",user.id).maybeSingle();
    if(request!==identityRequest)return;
    const memberId=member.data?.id||"00000000-0000-0000-0000-000000000000";
    const [creatorResult,membershipResult,premiumResult]=await Promise.all([
      client.from("creators").select("id").eq("member_id",memberId).eq("is_active",true).maybeSingle(),
      client.from("membership_subscriptions").select("id,status,plan_id,current_period_end").eq("user_id",user.id).in("status",["active","trialing","past_due"]).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
      client.from("cr_podcast_entitlements").select("id,status,ends_at").eq("member_user_id",user.id).eq("status","active").order("updated_at",{ascending:false}).limit(1).maybeSingle()
    ]);
    if(request!==identityRequest)return;
    creator=!!creatorResult.data;
    membership=membershipResult.data||null;
    premium=!!premiumResult.data;
    renderIdentity();
    await loadNotifications();
  }

  function subscribeRealtime(){
    const client=getDb(),id=uid();if(!client||!id)return;
    try{if(realtimeChannel)client.removeChannel(realtimeChannel)}catch(_){}
    realtimeChannel=null;
    try{
      realtimeChannel=client.channel("crowrules-global-nav-"+id.slice(0,12)+"-"+Math.random().toString(36).slice(2,7));
      realtimeChannel
        .on("postgres_changes",{event:"*",schema:"public",table:"podcast_notifications",filter:"user_id=eq."+id},p=>{
          if(p.eventType==="INSERT"){notifyLocal(p.new);broadcast("notification",p.new)}
          else if(p.eventType==="UPDATE"){
            notifications=notifications.map(n=>n.id===p.new.id?p.new:n);
            unreadCount=notifications.filter(n=>!n.is_read).length;
            renderNotificationCenter();renderIdentity();broadcast("notification-update",{notification:p.new});
          }
        })
        .on("postgres_changes",{event:"*",schema:"public",table:"membership_subscriptions",filter:"user_id=eq."+id},()=>{loadIdentity();broadcast("identity-refresh")})
        .on("postgres_changes",{event:"*",schema:"public",table:"cr_podcast_entitlements",filter:"member_user_id=eq."+id},()=>{loadIdentity();broadcast("identity-refresh")})
        .subscribe();
    }catch(_){}
  }

  function setupAuthSync(){
    const client=getDb();if(!client?.auth)return;
    try{
      authSubscription?.unsubscribe?.();
      const result=client.auth.onAuthStateChange((event,session)=>{
        user=session?.user||null;
        if(event==="SIGNED_OUT"){
          membership=null;premium=false;creator=false;notifications=[];unreadCount=0;
        }
        renderIdentity();renderNotificationCenter();
        broadcast("auth-change",{event});
        dispatch("auth-change",{event,user});
        clearTimeout(refreshTimer);
        refreshTimer=setTimeout(()=>loadIdentity().then(subscribeRealtime),0);
      });
      authSubscription=result.data?.subscription||null;
    }catch(_){}
  }

  function buildAccountPalette(){
    const dialog=document.createElement("div");
    dialog.className="cr-command-overlay";dialog.hidden=true;
    dialog.innerHTML='<div class="cr-command-dialog" role="dialog" aria-modal="true" aria-labelledby="cr-command-title"><div class="cr-command-top"><span class="cr-popover-kicker" id="cr-command-title">CROWRULES COMMAND</span><button type="button" class="cr-icon-button cr-command-close" aria-label="Close command palette">✕</button></div><div class="cr-command-search-wrap"><span>⌘</span><input id="cr-command-input" type="search" autocomplete="off" placeholder="Search your account, library, creator tools…" aria-label="Search account commands"></div><div class="cr-command-status"><span class="cr-presence-status">Guest</span><span class="cr-command-hint">Esc to close · Ctrl/⌘K to open</span></div><div class="cr-command-results" role="listbox" aria-label="Account commands"></div></div>';
    document.body.appendChild(dialog);
    const input=dialog.querySelector("#cr-command-input"),results=dialog.querySelector(".cr-command-results");
    const commands=()=>[
      ["Profile","Your public and member profile","profile.html","account"],
      ["My Library","Saved shows, episodes, favorites and listening","my-library.html","library"],
      ["Membership","Membership status and plan management","membership.html","membership"],
      ["Premium Library","Your premium podcast access","premium-library.html","premium"],
      ["Creator Studio","Create and manage podcasts","creator-studio.html","creator"],
      ["Monetization","Creator revenue and offers","creator-monetization-hub.html","creator"],
      ["Playback Security","Devices and playback security","playback-security.html","security"],
      ["Notifications","Open the full notification center","notifications.html","notifications"],
      ["Account Settings","Preferences and account controls","account-settings.html","settings"]
    ].filter(c=>user||c[0]==="Membership"||c[0]==="Notifications");
    function renderCommands(filter=""){
      const q=filter.trim().toLowerCase();
      const list=commands().filter(c=>(c[0]+" "+c[1]).toLowerCase().includes(q));
      results.innerHTML=list.length?list.map((c,i)=>'<a class="cr-command-item '+(i===0?"active":"")+'" role="option" href="'+href(c[2])+'"><span class="cr-command-icon">'+({account:"◎",library:"▣",membership:"◇",premium:"✦",creator:"◆",security:"⌁",notifications:"◌",settings:"⚙"}[c[3]]||"•")+'</span><span><strong>'+escapeHtml(c[0])+'</strong><small>'+escapeHtml(c[1])+'</small></span><kbd>↵</kbd></a>').join(""):'<div class="cr-command-empty">No matching command.</div>';
    }
    function open(){dialog.hidden=false;renderCommands(input.value);setTimeout(()=>input.focus(),0);openPanel="command"}
    function close(){dialog.hidden=true;if(openPanel==="command")openPanel=null}
    input.addEventListener("input",()=>renderCommands(input.value));
    dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
    dialog.querySelector(".cr-command-close").addEventListener("click",close);
    window.__crowRulesOpenCommandPalette=open;
    window.__crowRulesCloseCommandPalette=close;
  }

  function buildHeader(){
    const header=document.createElement("header");header.className="cr-global-header";header.setAttribute("role","banner");
    const inner=document.createElement("div");inner.className="cr-global-inner";
    const brand=document.createElement("a");brand.className="cr-global-brand";brand.href=href("home.html");brand.setAttribute("aria-label","CrowRules Podcasting home");brand.innerHTML='<span class="cr-global-brand-mark" aria-hidden="true">CR</span><span>CrowRules Podcasting</span>';inner.appendChild(brand);
    const desktop=document.createElement("nav");desktop.className="cr-global-nav";desktop.setAttribute("aria-label","Primary");
    const addLink=(parent,target,label,aliases,group)=>{const a=document.createElement("a");a.href=href(target);a.textContent=label;a.dataset.navGroup=group||"";if(isCurrent(aliases))a.setAttribute("aria-current","page");parent.appendChild(a)};
    nav.forEach(x=>addLink(desktop,x[0],x[1],x[2],x[3]));addLink(desktop,"help-center.html","Help",help,"account");
    const actions=document.createElement("div");actions.className="cr-global-actions";
    const notify=document.createElement("button");notify.type="button";notify.className="cr-notification-trigger";notify.setAttribute("aria-label","Open notifications");notify.setAttribute("aria-expanded","false");notify.innerHTML='<span aria-hidden="true">◌</span><span class="cr-notification-badge" hidden>0</span>';actions.appendChild(notify);
    const account=document.createElement("a");account.href=href("profile.html");account.className="cr-profile-link cr-global-identity";if(isCurrent(accountAliases))account.setAttribute("aria-current","page");actions.appendChild(account);
    const menu=document.createElement("button");menu.className="cr-global-menu";menu.type="button";menu.setAttribute("aria-label","Open navigation");menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-controls","cr-global-mobile-nav");menu.textContent="☰";
    const mobile=document.createElement("nav");mobile.className="cr-global-mobile";mobile.id="cr-global-mobile-nav";mobile.setAttribute("aria-label","Mobile primary");
    nav.forEach(x=>addLink(mobile,x[0],x[1],x[2],x[3]));addLink(mobile,"help-center.html","Help",help,"account");
    const mobileAccount=document.createElement("a");mobileAccount.href=href("profile.html");mobileAccount.textContent="Account & Command";mobileAccount.dataset.navGroup="account";mobile.appendChild(mobileAccount);
    inner.appendChild(desktop);inner.appendChild(actions);inner.appendChild(menu);header.appendChild(inner);header.appendChild(mobile);
    return{header,notify,account,menu,mobile};
  }

  function removeLegacyNavigation(){
    document.querySelectorAll("header.site-header").forEach(h=>{
      if(h.querySelector(".main-navigation,nav.main-navigation"))h.remove();
    });
    document.querySelectorAll(".main-navigation,[data-cr-global-navigation],[data-crowrules-nav],.cr-nav").forEach(el=>el.remove());
  }
  function removeDuplicateHeaders(){
    [...document.querySelectorAll(".cr-global-header")].slice(1).forEach(h=>h.remove());
    removeLegacyNavigation();
  }
  function closePanels(){
    document.querySelectorAll(".cr-nav-popover").forEach(p=>p.hidden=true);
    const t=document.querySelector(".cr-notification-trigger");if(t)t.setAttribute("aria-expanded","false");
    if(openPanel==="notifications")openPanel=null;
  }

  function mount(){
    removeDuplicateHeaders();
    if(document.querySelector(".cr-global-header")||!document.body)return;
    const ui=buildHeader();
    document.body.insertBefore(ui.header,document.body.firstChild);
    const panel=buildNotificationCenter();
    buildAccountPalette();

    ui.notify.addEventListener("click",()=>{
      const opening=panel.hidden;
      closePanels();panel.hidden=!opening;ui.notify.setAttribute("aria-expanded",String(opening));
      if(opening){openPanel="notifications";loadNotifications()}
    });
    ui.account.addEventListener("click",e=>{
      if(user&&window.__crowRulesOpenCommandPalette){e.preventDefault();window.__crowRulesOpenCommandPalette()}
    });
    ui.menu.addEventListener("click",()=>{
      const open=ui.mobile.classList.toggle("open");
      ui.menu.setAttribute("aria-expanded",String(open));
      ui.menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");
      ui.menu.textContent=open?"✕":"☰";
    });
    ui.mobile.addEventListener("click",e=>{
      if(e.target.closest("a")){ui.mobile.classList.remove("open");ui.menu.setAttribute("aria-expanded","false");ui.menu.textContent="☰"}
    });
    document.addEventListener("click",e=>{
      if(!e.target.closest(".cr-global-actions")&&!e.target.closest(".cr-notification-center"))closePanels();
    });
    document.addEventListener("keydown",e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();window.__crowRulesOpenCommandPalette?.()}
      if(e.key==="Escape"){window.__crowRulesCloseCommandPalette?.();closePanels();ui.mobile.classList.remove("open");ui.menu.setAttribute("aria-expanded","false");ui.menu.textContent="☰"}
    });
    window.addEventListener("resize",()=>{if(innerWidth>1040){ui.mobile.classList.remove("open");ui.menu.setAttribute("aria-expanded","false");ui.menu.textContent="☰"}},{passive:true});

    window.CrowRulesGlobalNavigation={
      version:VERSION,
      refresh:()=>loadIdentity().then(subscribeRealtime),
      openNotifications:()=>{panel.hidden=false;ui.notify.setAttribute("aria-expanded","true");openPanel="notifications";loadNotifications()},
      markRead,markAllRead,
      pushNotification:n=>{notifyLocal(n);broadcast("notification",n)},
      openCommandPalette:()=>window.__crowRulesOpenCommandPalette?.()
    };

    renderIdentity();renderNotificationCenter();
    setupAuthSync();
    loadIdentity().then(subscribeRealtime);
    clearInterval(pollTimer);
    pollTimer=setInterval(()=>{if(!document.hidden)loadIdentity().then(subscribeRealtime)},REFRESH_MS);
    window.addEventListener("pagehide",()=>{clearInterval(pollTimer);try{if(realtimeChannel)getDb()?.removeChannel(realtimeChannel)}catch(_){}});
    window.addEventListener("focus",()=>loadIdentity().then(subscribeRealtime));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadIdentity().then(subscribeRealtime)});
    window.addEventListener("crowrules:member-state",e=>{
      const r=e.detail?.reason;
      if(["signed-out","auth-change","ready","database-change","focus-sync","visibility-sync","sync-pulse"].includes(r)){
        clearTimeout(refreshTimer);
        refreshTimer=setTimeout(()=>loadIdentity().then(subscribeRealtime),50);
      }
      if(r==="database-change"&&e.detail?.table==="podcast_notifications")loadNotifications();
    });
  }

  function handleCrossTab(m){
    if(!m||m.source!=="crowrules-global-nav-84")return;
    if(m.type==="auth-change"||m.type==="identity-refresh"){loadIdentity().then(subscribeRealtime);return}
    if(m.type==="notification"&&m.payload)notifyLocal(m.payload);
    if(m.type==="notification-read"&&m.payload?.id){
      notifications=notifications.map(n=>n.id===m.payload.id?{...n,is_read:true}:n);
      unreadCount=notifications.filter(n=>!n.is_read).length;renderNotificationCenter();renderIdentity();
    }
    if(m.type==="notifications-read-all"){
      notifications=notifications.map(n=>({...n,is_read:true}));unreadCount=0;renderNotificationCenter();renderIdentity();
    }
    if(m.type==="notification-update"&&m.payload?.notification)notifyLocal(m.payload.notification);
  }

  try{
    if("BroadcastChannel"in window){
      const bc=new BroadcastChannel(CHANNEL_NAME);
      window.__crowRulesGlobalNavChannel=bc;
      bc.onmessage=e=>handleCrossTab(e.data);
    }
  }catch(_){}
  window.addEventListener("storage",e=>{
    if(e.key!==STORAGE_KEY||!e.newValue)return;
    try{handleCrossTab(JSON.parse(e.newValue))}catch(_){}
  });

  async function start(){
    await ensureDependencies();
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
    else mount();
  }
  start();
})();
