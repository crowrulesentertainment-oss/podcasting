/* CrowRules Podcasting — Global Header & Navigation System 6.2
    Hardened root/nested-path routing, active-section detection,
   accessible mobile navigation, and repository linking. */
(function(){
  if(window.__CROWRULES_GLOBAL_NAV_62__) return;
  window.__CROWRULES_GLOBAL_NAV_61__=true;

  function removeDuplicateHeaders(){
    [...document.querySelectorAll(".cr-global-header")].slice(1).forEach(h=>h.remove());
    document.querySelectorAll("[data-cr-global-navigation],[data-crowrules-nav],.cr-nav").forEach(el=>el.remove());
  }

  const nav=[
    ["home.html","Home",["index.html","home.html"]],
    ["discover.html","Discover",["discover.html","search.html","categories.html"]],
    ["podcasts.html","Podcasts",["podcasts.html","podcast.html"]],
    ["episodes.html","Episodes",["episodes.html","episode.html"]],
    ["creators.html","Creators",["creators.html","creator.html"]],
    ["create-podcast.html","Create",["create-podcast.html"]],
    ["creator-studio.html","Studio",["creator-studio.html","creator-dashboard.html"]],
    ["membership.html","Membership",["membership.html","subscriptions.html"]],
    ["premium-library.html","Premium",["premium-library.html","premium.html"]],
    ["creator-monetization-hub.html","Monetization",["creator-monetization-hub.html","monetization.html"]],
    ["playback-security.html","Security",["playback-security.html","playback-devices.html"]],
    ["profile.html","Profile",["profile.html","account.html","account-center.html","account-settings.html"]]
  ];

  const help=["help-center.html","help.html","support.html"];
  const path=location.pathname;
  const hasFile=/\/[^/]+\.[^/]+$/.test(path);
  const rawParts=path.split("/").filter(Boolean);
  const current=(hasFile?(rawParts.pop()||"index.html"):"index.html").toLowerCase();
  const prefix=hasFile&&rawParts.length?"../".repeat(rawParts.length):"";
  const isCurrent=aliases=>aliases.includes(current);
  const href=target=>prefix+target;

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

  const mobile=document.createElement("nav");
  mobile.className="cr-global-mobile";
  mobile.setAttribute("aria-label","Mobile primary");

  function addLink(parent,target,label,aliases){
    const a=document.createElement("a");
    a.href=href(target);
    a.textContent=label;
    if(isCurrent(aliases)){
      a.setAttribute("aria-current","page");
    }
    parent.appendChild(a);
  }

  nav.forEach(([target,label,aliases])=>{
    addLink(desktop,target,label,aliases);
    addLink(mobile,target,label,aliases);
  });
  addLink(desktop,"help-center.html","Help",help);
  addLink(mobile,"help-center.html","Help",help);

  function addExternalLink(parent){
    const a=document.createElement("a");
    a.href="https://github.com/crowrulesentertainment-oss/podcasting";
    a.textContent="GitHub Repository";
    a.target="_blank";
    a.rel="noopener noreferrer";
    a.className="cr-github-link";
    a.setAttribute("aria-label","Open the CrowRules Podcasting GitHub repository (opens in a new tab)");
    parent.appendChild(a);
  }
  addExternalLink(desktop);
  addExternalLink(mobile);

  const actions=document.createElement("div");
  actions.className="cr-global-actions";

  const account=document.createElement("a");
  account.href=href("profile.html");
  account.textContent="Account";
  account.className="cr-profile-link";
  account.setAttribute("aria-label","Open your CrowRules account");
  if(isCurrent(["profile.html","account.html","account-center.html","account-settings.html"])){
    account.setAttribute("aria-current","page");
  }
  actions.appendChild(account);

  const menu=document.createElement("button");
  menu.className="cr-global-menu";
  menu.type="button";
  menu.setAttribute("aria-label","Open navigation");
  menu.setAttribute("aria-expanded","false");
  menu.setAttribute("aria-controls","cr-global-mobile-nav");
  menu.textContent="☰";

  mobile.id="cr-global-mobile-nav";

  inner.appendChild(desktop);
  inner.appendChild(actions);
  inner.appendChild(menu);
  header.appendChild(inner);
  header.appendChild(mobile);

  function closeMenu(){
    mobile.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
    menu.setAttribute("aria-label","Open navigation");
    menu.textContent="☰";
  }

  function mount(){
    removeDuplicateHeaders();
    if(document.querySelector(".cr-global-header")) return;
    document.body.insertBefore(header,document.body.firstChild);

    menu.addEventListener("click",()=>{
      const open=mobile.classList.toggle("open");
      menu.setAttribute("aria-expanded",String(open));
      menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");
      menu.textContent=open?"✕":"☰";
    });

    mobile.addEventListener("click",event=>{
      if(event.target.closest("a")) closeMenu();
    });

    window.addEventListener("resize",()=>{
      if(window.innerWidth>1040) closeMenu();
    },{passive:true});

    if(!document.body.hasAttribute("data-cr-no-monetization-strip")){
      const css=href("css/monetization-integration.css");
      if(!document.querySelector('link[data-cr-monetization-css]')){
        const l=document.createElement("link");
        l.rel="stylesheet";
        l.href=css;
        l.dataset.crMonetizationCss="1";
        document.head.appendChild(l);
      }
      if(!document.querySelector('script[data-cr-monetization-js]')){
        const s=document.createElement("script");
        s.src=href("js/monetization-integration.js");
        s.defer=true;
        s.dataset.crMonetizationJs="1";
        document.head.appendChild(s);
      }
    }
  }

  if(document.body) mount();
  else document.addEventListener("DOMContentLoaded",mount,{once:true});
  window.addEventListener("load",removeDuplicateHeaders,{once:true});
})();