/* CrowRules Podcasting — Global Header & Navigation System 8.0
   One navigation layer, responsive destination groups, accessible mobile menu,
   active-page state, keyboard-safe More panel, and root/nested-path routing. */
(function(){
  if(window.__CROWRULES_GLOBAL_NAV_80__) return;
  window.__CROWRULES_GLOBAL_NAV_80__=true;

  const nav=[
    ["home.html","Home",["index.html","home.html"],"home"],
    ["discover.html","Discover",["discover.html","search.html","categories.html","rankings.html"],"discover"],
    ["podcasts.html","Podcasts",["podcasts.html","podcast.html"],"listen"],
    ["episodes.html","Episodes",["episodes.html","episode.html"],"listen"],
    ["creators.html","Creators",["creators.html","creator.html"],"discover"],
    ["create-podcast.html","Create",["create-podcast.html"],"create"],
    ["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html"],"create"]
  ];
  const more=[
    ["membership.html","Membership","Listener membership",["membership.html","subscriptions.html"],""],
    ["premium-library.html","Premium","Premium listening",["premium-library.html","premium.html"],""],
    ["creator-monetization-hub.html","Monetization","Offers and revenue",["creator-monetization-hub.html","monetization.html","monetization-suite.html","monetization-command-center.html"],"cr-more-accent"],
    ["playback-security.html","Security","Playback and devices",["playback-security.html","playback-devices.html"],""],
    ["profile.html","Profile","Account and identity",["profile.html","account.html","account-center.html","account-settings.html"],""],
    ["help-center.html","Help","Support and guides",["help-center.html","help.html","support.html"],""],
    ["navigation.html","Navigation","Platform journey",["navigation.html","site-map.html"],""],
    ["live.html","Live","Live audio",["live.html"],""]
  ];
  const github="https://github.com/crowrulesentertainment-oss/podcasting";

  function removeDuplicates(){
    document.querySelectorAll(".cr-global-header").forEach((el,i)=>{if(i) el.remove()});
    document.querySelectorAll("[data-cr-global-navigation],[data-crowrules-nav],.cr-nav").forEach(el=>el.remove());
  }

  const path=location.pathname;
  const hasFile=/\/[^/]+\.[^/]+$/.test(path);
  const parts=path.split("/").filter(Boolean);
  const current=(hasFile?(parts.pop()||"index.html"):"index.html").toLowerCase();
  const prefix=hasFile&&parts.length?"../".repeat(parts.length):"";
  const href=t=>prefix+t;
  const active=aliases=>aliases.includes(current);

  const header=document.createElement("header");
  header.className="cr-global-header";
  header.setAttribute("role","banner");

  const skip=document.createElement("a");
  skip.className="cr-global-skip";
  skip.href="#main-content";
  skip.textContent="Skip to main content";
  header.appendChild(skip);

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

  function addLink(parent,item){
    const [target,label,aliases,group]=item;
    const a=document.createElement("a");
    a.href=href(target);
    a.textContent=label;
    if(group) a.dataset.navGroup=group;
    if(active(aliases)) a.setAttribute("aria-current","page");
    parent.appendChild(a);
    return a;
  }
  nav.forEach(item=>addLink(desktop,item));

  const moreWrap=document.createElement("div");
  moreWrap.className="cr-global-more";
  const moreButton=document.createElement("button");
  moreButton.type="button";
  moreButton.className="cr-global-more-toggle";
  moreButton.setAttribute("aria-expanded","false");
  moreButton.setAttribute("aria-controls","cr-global-more-panel");
  moreButton.innerHTML='More <span class="cr-chevron" aria-hidden="true">⌄</span>';
  const morePanel=document.createElement("div");
  morePanel.className="cr-global-more-panel";
  morePanel.id="cr-global-more-panel";
  morePanel.hidden=true;
  morePanel.setAttribute("aria-label","More destinations");
  more.forEach(([target,label,desc,aliases,klass])=>{
    const a=document.createElement("a");
    a.href=href(target);
    if(klass) a.className=klass;
    if(active(aliases)) a.setAttribute("aria-current","page");
    a.innerHTML="<strong>"+label+"</strong><span>"+desc+"</span>";
    morePanel.appendChild(a);
  });
  moreWrap.append(moreButton,morePanel);
  desktop.appendChild(moreWrap);

  const actions=document.createElement("div");
  actions.className="cr-global-actions";
  const account=document.createElement("a");
  account.className="cr-profile-link";
  account.href=href("profile.html");
  account.textContent="Account";
  account.setAttribute("aria-label","Open your CrowRules account");
  if(active(["profile.html","account.html","account-center.html","account-settings.html"])) account.setAttribute("aria-current","page");
  actions.appendChild(account);

  const menu=document.createElement("button");
  menu.type="button";
  menu.className="cr-global-menu";
  menu.setAttribute("aria-label","Open navigation");
  menu.setAttribute("aria-expanded","false");
  menu.setAttribute("aria-controls","cr-global-mobile-nav");
  menu.textContent="☰";

  const mobile=document.createElement("nav");
  mobile.className="cr-global-mobile";
  mobile.id="cr-global-mobile-nav";
  mobile.setAttribute("aria-label","Mobile primary");
  [...nav,...more.map(([t,l,d,a])=>[t,l,a,"more"])].forEach(item=>addLink(mobile,item));

  inner.append(desktop,actions,menu);
  header.append(inner,mobile);

  function closeMore(){
    morePanel.hidden=true;
    moreButton.setAttribute("aria-expanded","false");
  }
  function toggleMore(){
    const open=morePanel.hidden;
    morePanel.hidden=!open;
    moreButton.setAttribute("aria-expanded",String(open));
  }
  function closeMobile(){
    mobile.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
    menu.setAttribute("aria-label","Open navigation");
    menu.textContent="☰";
  }

  function mount(){
    removeDuplicates();
    if(document.querySelector(".cr-global-header")) return;
    document.body.prepend(header);

    const main=document.querySelector("main");
    if(main&&!main.id) main.id="main-content";

    moreButton.addEventListener("click",toggleMore);
    document.addEventListener("click",e=>{
      if(!moreWrap.contains(e.target)) closeMore();
    });
    moreButton.addEventListener("keydown",e=>{
      if(e.key==="Escape"){closeMore();moreButton.focus()}
    });
    morePanel.addEventListener("keydown",e=>{
      if(e.key==="Escape"){closeMore();moreButton.focus()}
    });

    menu.addEventListener("click",()=>{
      const open=mobile.classList.toggle("open");
      menu.setAttribute("aria-expanded",String(open));
      menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");
      menu.textContent=open?"✕":"☰";
      if(open) closeMore();
    });
    mobile.addEventListener("click",e=>{
      if(e.target.closest("a")) closeMobile();
    });
    window.addEventListener("resize",()=>{
      if(window.innerWidth>980){closeMobile();closeMore()}
    },{passive:true});

    if(!document.body.hasAttribute("data-cr-no-monetization-strip")){
      const css=href("css/monetization-integration.css");
      if(!document.querySelector('link[data-cr-monetization-css]')){
        const l=document.createElement("link");
        l.rel="stylesheet";l.href=css;l.dataset.crMonetizationCss="1";document.head.appendChild(l);
      }
      if(!document.querySelector('script[data-cr-monetization-js]')){
        const s=document.createElement("script");
        s.src=href("js/monetization-integration.js");s.defer=true;s.dataset.crMonetizationJs="1";document.head.appendChild(s);
      }
    }
  }
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded",mount,{once:true});
  window.addEventListener("load",removeDuplicates,{once:true});
})();