/* CrowRules Podcasting — Universal Site Experience V3 */
(function(){
  if(window.__crowRulesSiteUXV3)return;
  window.__crowRulesSiteUXV3=true;

  const $=(s,r=document)=>r.querySelector(s);

  function styles(){
    if($("#crSiteUXStyles"))return;
    const s=document.createElement("style");
    s.id="crSiteUXStyles";
    s.textContent=`
      :root{--cr-cyan:#00e5ff;--cr-purple:#8b5cff;--cr-pink:#ff4fd8}
      .cr-skip{position:fixed;left:12px;top:12px;z-index:30000;transform:translateY(-150%);padding:10px 14px;border-radius:10px;background:#090a13;color:#fff;border:1px solid rgba(0,229,255,.4);font:800 11px Montserrat,sans-serif;text-decoration:none}
      .cr-skip:focus{transform:none}
      .cr-scroll-progress{position:fixed;left:0;top:0;height:3px;width:0;z-index:29999;background:linear-gradient(90deg,var(--cr-cyan),var(--cr-purple),var(--cr-pink));box-shadow:0 0 12px rgba(0,229,255,.5);pointer-events:none}
      .cr-top{position:fixed;right:18px;bottom:92px;z-index:11999;width:40px;height:40px;border:1px solid rgba(0,229,255,.25);border-radius:50%;background:rgba(7,8,17,.9);color:#fff;cursor:pointer;display:none;backdrop-filter:blur(12px)}
      .cr-top.show{display:block}
      .cr-toast-stack{position:fixed;right:18px;top:78px;z-index:25000;display:grid;gap:8px;pointer-events:none}
      .cr-toast{max-width:340px;padding:11px 14px;border:1px solid rgba(0,229,255,.22);border-radius:12px;background:rgba(7,8,17,.96);box-shadow:0 16px 45px #0008;color:#e8ecf7;font:700 10px Montserrat,sans-serif;animation:crToastIn .2s ease}
      @keyframes crToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
      .cr-online{position:fixed;left:18px;bottom:92px;z-index:11998;padding:7px 10px;border:1px solid rgba(54,226,155,.25);border-radius:999px;background:rgba(7,8,17,.9);color:#72f0b6;font:800 8px Orbitron,sans-serif;letter-spacing:.08em;display:none}
      .cr-online.show{display:block}.cr-online.offline{color:#ff8797;border-color:rgba(255,93,115,.3)}
      body.cr-page-ready{animation:crPageIn .24s ease both}
      @keyframes crPageIn{from{opacity:.86;transform:translateY(3px)}to{opacity:1;transform:none}}
      @media(max-width:820px){.cr-top{right:10px;bottom:68px}.cr-online{left:10px;bottom:68px}.cr-toast-stack{right:10px;top:70px}}
      @media(prefers-reduced-motion:reduce){body.cr-page-ready{animation:none}.cr-toast{animation:none}}
    `;
    document.head.appendChild(s);
  }

  function init(){
    styles();
    document.body.classList.add("cr-page-ready");

    if(!$("#crSkip")){
      const a=document.createElement("a");a.id="crSkip";a.className="cr-skip";a.href="#main";a.textContent="Skip to content";
      document.body.prepend(a);
      const main=$("main");if(main&&!main.id)main.id="main";
    }

    if(!$("#crScrollProgress")){
      const p=document.createElement("div");p.id="crScrollProgress";p.className="cr-scroll-progress";document.body.appendChild(p);
      const update=()=>{const h=document.documentElement.scrollHeight-innerHeight; p.style.width=(h>0?Math.min(100,scrollY/h*100):0)+"%"};addEventListener("scroll",update,{passive:true});addEventListener("resize",update);update();
    }

    if(!$("#crTop")){
      const b=document.createElement("button");b.id="crTop";b.className="cr-top";b.type="button";b.title="Back to top";b.setAttribute("aria-label","Back to top");b.textContent="↑";
      b.onclick=()=>scrollTo({top:0,behavior:"smooth"});document.body.appendChild(b);
      const update=()=>b.classList.toggle("show",scrollY>500);addEventListener("scroll",update,{passive:true});update();
    }

    if(!$("#crOnline")){
      const o=document.createElement("div");o.id="crOnline";o.className="cr-online";document.body.appendChild(o);
      const update=()=>{o.textContent=navigator.onLine?"● ONLINE":"● OFFLINE";o.classList.toggle("offline",!navigator.onLine);o.classList.add("show");clearTimeout(o._t);if(navigator.onLine)o._t=setTimeout(()=>o.classList.remove("show"),2200)};
      addEventListener("online",update);addEventListener("offline",update);update();
    }

    if(!$("#crToastStack")){const t=document.createElement("div");t.id="crToastStack";t.className="cr-toast-stack";document.body.appendChild(t)}

    window.CrowRulesToast=function(message,ms=2600){
      const stack=$("#crToastStack");if(!stack)return;
      const t=document.createElement("div");t.className="cr-toast";t.textContent=String(message);stack.appendChild(t);
      setTimeout(()=>t.remove(),ms);
    };

    document.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const x=$("#crCommandInput, input[type=search], input[name=search]");if(x){x.focus();x.select();}else{location.href=(location.pathname.includes("/creator/")||location.pathname.includes("/admin/")?"../":"")+"search.html"}}
      if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement?.tagName||"")){const x=$("#crCommandInput, input[type=search], input[name=search]");if(x){e.preventDefault();x.focus()}}
      if(e.key==="Escape")document.querySelectorAll(".cr-nav-group.open").forEach(x=>x.classList.remove("open"));
    });

    document.querySelectorAll("a[href]").forEach(a=>{
      const href=a.getAttribute("href")||"";
      if(/^https?:/i.test(href)&&!href.includes(location.host)){a.target="_blank";a.rel="noopener noreferrer"}
    });

    if(!document.querySelector('meta[name="color-scheme"]')){
      const m=document.createElement("meta");m.name="color-scheme";m.content="dark";document.head.appendChild(m);
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();