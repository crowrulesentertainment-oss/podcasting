(()=>{"use strict";
const appView=document.getElementById("appView"),menu=document.getElementById("appMenu"),toggle=document.getElementById("menuToggle"),label=document.getElementById("viewLabel"),member=document.getElementById("memberLabel");
const views={home:"home.html?shell=1",shows:"home.html?shell=1#shows",episodes:"home.html?shell=1#episodes",community:"home.html?shell=1#community",creators:"home.html?shell=1#creators",studio:"creator-studio.html?shell=1",account:"account.html?shell=1",launch:"launch.html?shell=1"};
const routeForHref=href=>{const h=(href||"").split("?")[0];if(h==="account.html")return"account";if(h==="launch.html")return"launch";if(h==="home.html"||h==="")return"home";if(h.startsWith("home.html#"))return h.slice(h.indexOf("#")+1);return null};
let current="";

function viewFromHash(){const h=location.hash.replace(/^#/,"").split("?")[0];return views[h]?h:"home"}
function setActive(view){document.querySelectorAll("[data-view]").forEach(a=>a.classList.toggle("active",a.dataset.view===view))}
function scrollTarget(view){requestAnimationFrame(()=>{const id={shows:"shows",episodes:"episodes",community:"community",creators:"creators"}[view];if(id)document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});else window.scrollTo({top:0,behavior:"smooth"})})}

async function loadStyles(doc){
 const links=[...doc.querySelectorAll('link[rel="stylesheet"]')];
 const inline=[...doc.querySelectorAll("style")];
 for(const l of links){
  const href=l.getAttribute("href");if(!href||href.startsWith("https://fonts.googleapis.com"))continue;
  const resolved=new URL(href,location.href).href;
  if([...document.styleSheets].some(s=>s.href===resolved))continue;
  const copy=document.createElement("link");copy.rel="stylesheet";copy.href=resolved;copy.dataset.crShellView="1";document.head.appendChild(copy);
 }
 for(const s of inline){const copy=document.createElement("style");copy.textContent=s.textContent;copy.dataset.crShellView="1";document.head.appendChild(copy)}
}

async function runScripts(doc){
 for(const old of [...document.querySelectorAll("script[data-cr-shell-view]")])old.remove();
 for(const source of [...doc.scripts]){
  let src=source.getAttribute("src");
  if(src){
   const u=new URL(src,location.href);
   if(u.pathname.endsWith("/podcasting-sitewide-v1.js")||u.pathname.endsWith("/podcasting-sitewide-v3.js"))u.searchParams.set("shell","1");
   await new Promise(resolve=>{const s=document.createElement("script");s.src=u.href;s.defer=false;s.dataset.crShellView="1";s.onload=resolve;s.onerror=resolve;document.body.appendChild(s)})
  }else if(source.textContent.trim()){
   const s=document.createElement("script");s.textContent=source.textContent;s.dataset.crShellView="1";document.body.appendChild(s)
  }
 }
}

function bindViewLinks(){
 appView.querySelectorAll("a").forEach(a=>{
  if(a.dataset.crShellBound)return;
  const href=a.getAttribute("href")||"";
  if(href.startsWith("#")){
   const target=href.slice(1);if(target&&document.getElementById(target)){a.dataset.crShellBound="1";a.addEventListener("click",e=>{e.preventDefault();history.pushState({view:current},"","#"+target);scrollTarget(target)})}
   return;
  }
  const view=routeForHref(href);
  if(view){a.dataset.crShellBound="1";a.addEventListener("click",e=>{e.preventDefault();navigate(view,true)})}
 });
}

async function navigate(view,push=true){
 if(!views[view])view="home";
 current=view;setActive(view);label.textContent=view.toUpperCase()+" // NATIVE SHELL";
 menu.classList.remove("open");toggle.setAttribute("aria-expanded","false");
 appView.innerHTML='<div class="cr-loading">CONNECTING TO '+view.toUpperCase()+'…</div>';
 if(push){const hash="#"+view;if(location.hash!==hash)history.pushState({view},"",hash)}
 const url=views[view];
 try{
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const text=await response.text();
  const doc=new DOMParser().parseFromString(text,"text/html");
  await loadStyles(doc);
  const sourceMain=doc.querySelector("main");
  if(!sourceMain)throw new Error("View has no main content");
  appView.innerHTML="";
  const viewRoot=document.createElement("div");viewRoot.className="cr-view";
  [...doc.body.children].forEach(node=>{
   if(node.tagName==="SCRIPT"||node.tagName==="FOOTER"||node.tagName==="HEADER")return;
   viewRoot.appendChild(node.cloneNode(true));
  });
  if(!viewRoot.querySelector("main")){const mainClone=sourceMain.cloneNode(true);viewRoot.appendChild(mainClone)}
  appView.appendChild(viewRoot);
  document.body.classList.add("cr-shell-view");
  bindViewLinks();
  await runScripts(doc);
  bindViewLinks();
  if(view!=="launch")scrollTarget(view==="home"&&location.hash==="#home"?"home":view);
 }catch(error){
  console.error("[CrowRules Native Shell]",error);
  appView.innerHTML='<div class="cr-error"><b>TRANSMISSION ERROR</b>The '+view+' view could not be loaded. Please try again.<br><small>'+String(error.message||error)+'</small></div>';
 }
}

document.querySelectorAll("[data-view]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.view,true)}));
toggle.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open))});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){menu.classList.remove("open");toggle.setAttribute("aria-expanded","false")}});
addEventListener("popstate",()=>navigate(viewFromHash(),false));
addEventListener("hashchange",()=>navigate(viewFromHash(),false));
addEventListener("storage",e=>{if(e.key==="crowrules_podcasting_universal_player_v3"){window.dispatchEvent(new StorageEvent("storage",e))}});
try{
 const raw=localStorage.getItem("crowrules_podcasting_member_state");
 if(raw){const s=JSON.parse(raw);if(s?.display_name)member.textContent=s.display_name.toUpperCase()}
}catch{}
navigate(viewFromHash(),false);
})();