/* CrowRules Podcasting — Global Header & Navigation System 3.0 */
(function(){
  if(window.__CROWRULES_GLOBAL_NAV_3__) return;
  window.__CROWRULES_GLOBAL_NAV_3__=true;
  const nav=[
    ["home.html","Home"],["discover.html","Discover"],["podcasts.html","Podcasts"],["creators.html","Creators"],
    ["create-podcast.html","Create"],["creator-studio.html","Studio"],["membership.html","Membership"],
    ["profile.html","Profile"],["help-center.html","Help"]
  ];
  const path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const header=document.createElement("header"); header.className="cr-global-header";
  const inner=document.createElement("div"); inner.className="cr-global-inner";
  const brand=document.createElement("a"); brand.className="cr-global-brand"; brand.href="home.html"; brand.innerHTML='<span class="cr-global-brand-mark">CR</span><span>CrowRules Podcasting</span>';
  inner.appendChild(brand);
  const desktop=document.createElement("nav"); desktop.className="cr-global-nav"; desktop.setAttribute("aria-label","Primary");
  const mobile=document.createElement("nav"); mobile.className="cr-global-mobile"; mobile.setAttribute("aria-label","Mobile primary");
  nav.forEach(([href,label])=>{
    const a=document.createElement("a"); a.href=href; a.textContent=label;
    if(path===href.toLowerCase()) a.setAttribute("aria-current","page");
    desktop.appendChild(a);
    const m=a.cloneNode(true); mobile.appendChild(m);
  });
  const actions=document.createElement("div"); actions.className="cr-global-actions";
  const profile=document.createElement("a"); profile.href="profile.html"; profile.textContent="Account"; profile.className="cr-profile-link"; actions.appendChild(profile);
  const menu=document.createElement("button"); menu.className="cr-global-menu"; menu.type="button"; menu.setAttribute("aria-label","Open navigation"); menu.setAttribute("aria-expanded","false"); menu.textContent="☰";
  inner.appendChild(desktop); inner.appendChild(actions); inner.appendChild(menu); header.appendChild(inner); header.appendChild(mobile);
  function mount(){document.body.insertBefore(header,document.body.firstChild); menu.addEventListener("click",()=>{const open=mobile.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"✕":"☰"});}
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded",mount,{once:true});
})();