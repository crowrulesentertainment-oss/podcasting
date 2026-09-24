/* CrowRules Podcasting — Global Header & Navigation System 8.1
   Context-aware single navigation layer.
   Adds signed-in/member/creator/premium state, notifications,
   unified account menu, responsive navigation, and auth-aware UI. */
(function(){
  "use strict";
  if(window.__CROWRULES_GLOBAL_NAV_81__) return;
  window.__CROWRULES_GLOBAL_NAV_81__=true;

  const NAV=[
    ["home.html","Home",["index.html","home.html"],"home"],
    ["discover.html","Discover",["discover.html","search.html","categories.html","rankings.html"],"discover"],
    ["podcasts.html","Podcasts",["podcasts.html","podcast.html"],"listen"],
    ["episodes.html","Episodes",["episodes.html","episode.html","live.html"],"listen"],
    ["creators.html","Creators",["creators.html","creator.html"],"create"],
    ["create-podcast.html","Create",["create-podcast.html"],"create"],
    ["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html","upload-episode.html"],"create"],
    ["membership.html","Membership",["membership.html","subscriptions.html"],"account"],
    ["premium-library.html","Premium",["premium-library.html","premium.html"],"account"],
    ["creator-monetization-hub.html","Monetization",["creator-monetization-hub.html","monetization.html","monetization-suite.html","monetization-command-center.html"],"growth"],
    ["playback-security.html","Security",["playback-security.html","playback-devices.html"],"account"]
  ];
  const HELP=["help-center.html","help.html","support.html"];
  const path=location.pathname;
  const hasFile=/\/[^/]+\.[^/]+$/.test(path);
  const rawParts=path.split("/").filter(Boolean);
  const current=(hasFile?(rawParts.pop()||"index.html"):"index.html").toLowerCase();
  const prefix=hasFile&&rawParts.length?"../".repeat(rawParts.length):"";
  const href=target=>prefix+target;
  const active=aliases=>aliases.includes(current);

  function getClient(){
    if(window.supabaseClient) return window.supabaseClient;
    if(window.supabase && window.CROWRULES_SUPABASE_URL && window.CROWRULES_SUPABASE_PUBLISHABLE_KEY){
      try{
        window.supabaseClient=window.supabase.createClient(
          window.CROWRULES_SUPABASE_URL,
          window.CROWRULES_SUPABASE_PUBLISHABLE_KEY
        );
        return window.supabaseClient;
      }catch(_){}
    }
    return null;
  }

  function removeDuplicateHeaders(){
    [...document.querySelectorAll(".cr-global-header")].slice(1).forEach(h=>h.remove());
    document.querySelectorAll("[data-cr-global-navigation],[data-crowrules-nav],.cr-nav").forEach(el=>el.remove());
  }

  const header=document.createElement("header");
  header.className="cr-global-header";
  header.setAttribute("role","banner");

  const inner=document.createElement("div");
  inner.className="cr-global-inner";

  const brand=document.createElement("a");
  brand.className="cr-global-brand";
  brand.href=href("home.html");
  brand.setAttribute("aria-label","CrowRules Podcasting home");
  brand.innerHTML='<span class="cr-global-brand-mark" aria-hidden="true">CR</span><span>CrowRules Podcasting</span>';
  inner.appendChild(brand);

  const desktop=document.createElement("nav");
  desktop.className="cr-global-nav";
  desktop.setAttribute("aria-label","Primary");

  const actions=document.createElement("div");
  actions.className="cr-global-actions";

  const mobile=document.createElement("nav");
  mobile.className="cr-global-mobile";
  mobile.setAttribute("aria-label","Mobile primary");

  const menu=document.createElement("button");
  menu.className="cr-global-menu";
  menu.type="button";
  menu.setAttribute("aria-label","Open navigation");
  menu.setAttribute("aria-expanded","false");
  menu.setAttribute("aria-controls","cr-global-mobile-nav");
  menu.textContent="☰";
  mobile.id="cr-global-mobile-nav";

  const context=document.createElement("div");
  context.className="cr-global-context";
  context.setAttribute("aria-live","polite");

  function addLink(parent,target,label,aliases,group){
    const a=document.createElement("a");
    a.href=href(target);
    a.textContent=label;
    a.dataset.navGroup=group||"";
    if(active(aliases)) a.setAttribute("aria-current","page");
    parent.appendChild(a);
    return a;
  }

  NAV.forEach(([target,label,aliases,group])=>{
    addLink(desktop,target,label,aliases,group);
    addLink(mobile,target,label,aliases,group);
  });
  addLink(desktop,"help-center.html","Help",HELP,"account");
  addLink(mobile,"help-center.html","Help",HELP,"account");

  function externalLink(parent){
    const a=document.createElement("a");
    a.href="https://github.com/crowrulesentertainment-oss/podcasting";
    a.textContent="GitHub Repository";
    a.target="_blank";
    a.rel="noopener noreferrer";
    a.className="cr-github-link";
    a.setAttribute("aria-label","Open the CrowRules Podcasting GitHub repository (opens in a new tab)");
    parent.appendChild(a);
  }
  externalLink(desktop);
  externalLink(mobile);

  function makeIconLink(target,label,icon,className){
    const a=document.createElement("a");
    a.href=href(target);
    a.className=className||"";
    a.setAttribute("aria-label",label);
    a.innerHTML='<span aria-hidden="true">'+icon+'</span><span class="cr-context-label">'+label+'</span>';
    return a;
  }

  const notifications=makeIconLink("notifications.html","Notifications","🔔","cr-notification-link");
  notifications.hidden=true;
  actions.appendChild(notifications);

  const accountWrap=document.createElement("div");
  accountWrap.className="cr-account";
  const accountButton=document.createElement("button");
  accountButton.type="button";
  accountButton.className="cr-account-button";
  accountButton.setAttribute("aria-haspopup","menu");
  accountButton.setAttribute("aria-expanded","false");
  accountButton.setAttribute("aria-controls","cr-account-menu");
  accountButton.innerHTML='<span class="cr-account-avatar" aria-hidden="true">CR</span><span class="cr-account-copy"><strong>Account</strong><small>Guest</small></span><span class="cr-account-chevron" aria-hidden="true">⌄</span>';
  const accountMenu=document.createElement("div");
  accountMenu.className="cr-account-menu";
  accountMenu.id="cr-account-menu";
  accountMenu.setAttribute("role","menu");
  accountMenu.setAttribute("aria-label","Account menu");
  accountMenu.hidden=true;
  accountWrap.append(accountButton,accountMenu);
  actions.appendChild(accountWrap);

  inner.append(desktop,actions,menu);
  header.append(inner,mobile,context);

  function menuItem(hrefValue,label,meta,action){
    const a=document.createElement("a");
    a.href=hrefValue;
    a.setAttribute("role","menuitem");
    a.innerHTML='<span class="cr-account-item-icon" aria-hidden="true">'+(meta?.icon||"•")+'</span><span><strong>'+label+'</strong>'+(meta?.sub?'<small>'+meta.sub+'</small>':"")+'</span>';
    if(action) a.dataset.action=action;
    return a;
  }

  function guestMenu(){
    accountMenu.innerHTML="";
    accountMenu.append(
      menuItem(href("login.html"),"Sign In",{icon:"↪",sub:"Access your CrowRules account"}),
      menuItem(href("signup.html"),"Create Account",{icon:"＋",sub:"Join the CrowRules universe"}),
      menuItem(href("membership.html"),"Membership",{icon:"✦",sub:"Explore member benefits"}),
      menuItem(href("help-center.html"),"Help Center",{icon:"?",sub:"Get platform support"})
    );
  }

  function memberMenu(state){
    accountMenu.innerHTML="";
    const name=state.name||"Member";
    const rows=[
      menuItem(href("profile.html"),"My Profile",{icon:"◎",sub:name}),
      menuItem(href("my-library.html"),"My Library",{icon:"▣",sub:"Saved shows, episodes and progress"}),
      menuItem(href("membership.html"),state.premium?"Premium Member":"Membership",{icon:"✦",sub:state.premium?"Premium access active":"Manage membership"}),
      menuItem(href("notifications.html"),"Notifications",{icon:"🔔",sub:state.unread?state.unread+" unread":"All caught up"}),
      menuItem(href("playback-security.html"),"Playback & Security",{icon:"◈",sub:"Devices and playback controls"})
    ];
    if(state.creator) rows.splice(2,0,menuItem(href("creator-studio.html"),"Creator Studio",{icon:"◆",sub:"Manage your shows and episodes"}));
    rows.push(menuItem(href("account-settings.html"),"Account Settings",{icon:"⚙",sub:"Identity and preferences"}));
    rows.push(menuItem("#","Sign Out",{icon:"↩",sub:"Sign out of this device"},"signout"));
    rows.forEach(x=>accountMenu.appendChild(x));
  }

  function paintGuest(){
    notifications.hidden=true;
    accountButton.innerHTML='<span class="cr-account-avatar" aria-hidden="true">CR</span><span class="cr-account-copy"><strong>Account</strong><small>Guest</small></span><span class="cr-account-chevron" aria-hidden="true">⌄</span>';
    accountButton.classList.remove("is-member","is-premium","is-creator");
    guestMenu();
  }

  function paintMember(state){
    notifications.hidden=false;
    notifications.dataset.unread=String(state.unread||0);
    notifications.title=state.unread?state.unread+" unread notification"+(state.unread===1?"":"s"):"Notifications";
    const first=(state.name||state.email||"Member").trim();
    const initials=first.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"CR";
    accountButton.innerHTML='<span class="cr-account-avatar" aria-hidden="true">'+initials+'</span><span class="cr-account-copy"><strong>'+escapeHtml(first)+'</strong><small>'+ (state.creator?"Creator":state.premium?"Premium Member":"Member") +'</small></span><span class="cr-account-chevron" aria-hidden="true">⌄</span>';
    accountButton.classList.toggle("is-member",true);
    accountButton.classList.toggle("is-premium",!!state.premium);
    accountButton.classList.toggle("is-creator",!!state.creator);
    memberMenu(state);
  }

  function escapeHtml(value){
    return String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  async function loadContext(){
    const db=getClient();
    if(!db){ paintGuest(); return; }
    try{
      const {data:{user}}=await db.auth.getUser();
      if(!user){ paintGuest(); return; }

      const state={
        email:user.email||"",
        name:user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"Member",
        creator:false,
        premium:false,
        unread:0
      };

      const results=await Promise.allSettled([
        db.from("creators").select("id").eq("member_id",user.id).limit(1),
        db.from("membership_subscriptions").select("id,status,plan_name,expires_at").eq("user_id",user.id).limit(10),
        db.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null)
      ]);
      const creatorResult=results[0];
      const membershipResult=results[1];
      const notificationResult=results[2];

      state.creator=creatorResult.status==="fulfilled" && !creatorResult.value.error && (creatorResult.value.data||[]).length>0;
      if(membershipResult.status==="fulfilled" && !membershipResult.value.error){
        const rows=membershipResult.value.data||[];
        state.premium=rows.some(row=>{
          const status=String(row.status||"").toLowerCase();
          if(!["active","trialing","paid","current"].includes(status)) return false;
          if(row.expires_at && new Date(row.expires_at).getTime()<Date.now()) return false;
          return true;
        });
      }
      if(notificationResult.status==="fulfilled" && !notificationResult.value.error){
        state.unread=notificationResult.value.count||0;
      }
      paintMember(state);
    }catch(_){ paintGuest(); }
  }

  function closeAccount(){
    accountMenu.hidden=true;
    accountButton.setAttribute("aria-expanded","false");
  }
  function openAccount(){
    accountMenu.hidden=false;
    accountButton.setAttribute("aria-expanded","true");
  }

  function closeMobile(){
    mobile.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
    menu.setAttribute("aria-label","Open navigation");
    menu.textContent="☰";
  }

  function mount(){
    removeDuplicateHeaders();
    if(document.querySelector(".cr-global-header")) return;
    document.body.insertBefore(header,document.body.firstChild);

    accountButton.addEventListener("click",()=>{
      const open=accountButton.getAttribute("aria-expanded")==="true";
      open?closeAccount():openAccount();
    });

    accountMenu.addEventListener("click",async event=>{
      const item=event.target.closest("[data-action='signout']");
      if(!item) return;
      event.preventDefault();
      closeAccount();
      const db=getClient();
      try{ if(db) await db.auth.signOut(); }catch(_){}
      paintGuest();
      location.href=href("login.html");
    });

    menu.addEventListener("click",()=>{
      const open=mobile.classList.toggle("open");
      menu.setAttribute("aria-expanded",String(open));
      menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");
      menu.textContent=open?"✕":"☰";
    });
    mobile.addEventListener("click",event=>{
      if(event.target.closest("a")) closeMobile();
    });

    document.addEventListener("click",event=>{
      if(!accountWrap.contains(event.target)) closeAccount();
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){ closeAccount(); closeMobile(); }
    });
    window.addEventListener("resize",()=>{
      if(window.innerWidth>1040) closeMobile();
    },{passive:true});

    window.addEventListener("crowrules:member-state",loadContext);
    loadContext();

    if(!document.body.hasAttribute("data-cr-no-monetization-strip")){
      const css=href("css/monetization-integration.css");
      if(!document.querySelector('link[data-cr-monetization-css]')){
        const l=document.createElement("link");
        l.rel="stylesheet"; l.href=css; l.dataset.crMonetizationCss="1"; document.head.appendChild(l);
      }
      if(!document.querySelector('script[data-cr-monetization-js]')){
        const s=document.createElement("script");
        s.src=href("js/monetization-integration.js"); s.defer=true; s.dataset.crMonetizationJs="1"; document.head.appendChild(s);
      }
    }
  }

  if(document.body) mount(); else document.addEventListener("DOMContentLoaded",mount,{once:true});
  window.addEventListener("load",removeDuplicateHeaders,{once:true});
})();