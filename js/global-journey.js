(() => {
  if (window.__CROWRULES_JOURNEY_2__) return;
  window.__CROWRULES_JOURNEY_2__ = true;
  const style=document.createElement("style");
  style.textContent="/* CrowRules Podcasting — Universal Journey Launcher */\n.cr-journey-launcher{position:fixed;right:18px;bottom:18px;z-index:99990;border:1px solid rgba(66,232,255,.35);border-radius:999px;background:rgba(8,8,18,.94);color:#f5f7ff;padding:11px 16px;box-shadow:0 10px 35px rgba(0,0,0,.4);backdrop-filter:blur(14px);cursor:pointer;font:600 13px/1.2 Montserrat,Arial,sans-serif}\n.cr-journey-launcher:hover{transform:translateY(-2px);border-color:rgba(155,108,255,.6)}\n.cr-journey-panel{position:fixed;right:18px;bottom:70px;width:min(360px,calc(100vw - 36px));z-index:99991;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(8,8,18,.97);box-shadow:0 25px 70px rgba(0,0,0,.55);backdrop-filter:blur(18px);display:none}\n.cr-journey-panel.open{display:block}\n.cr-journey-panel h2{margin:0 0 4px;font:700 18px Orbitron,Arial,sans-serif}\n.cr-journey-panel p{margin:0 0 14px;color:#aeb4c7;font:400 12px Montserrat,Arial,sans-serif}\n.cr-journey-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n.cr-journey-grid a{display:block;padding:10px 11px;border:1px solid rgba(255,255,255,.09);border-radius:11px;color:#f5f7ff;text-decoration:none;background:rgba(255,255,255,.035);font:600 12px Montserrat,Arial,sans-serif}\n.cr-journey-grid a:hover{border-color:rgba(66,232,255,.4);background:rgba(66,232,255,.06)}\n.cr-journey-close{position:absolute;right:12px;top:10px;background:none;border:0;color:#aeb4c7;font-size:18px;cursor:pointer}\n@media(max-width:520px){.cr-journey-launcher{right:12px;bottom:12px}.cr-journey-panel{right:12px;bottom:62px}}\n";
  document.head.appendChild(style);
  const links=[
    ["⌂ Home","home.html"],["◉ Discover","discover.html"],["🎙 Podcasts","podcasts.html"],["👥 Creators","creators.html"],
    ["＋ Create Podcast","create-podcast.html"],["⚡ Creator Studio","creator-studio.html"],["◎ Profile","profile.html"],
    ["★ Membership","membership.html"],["▣ My Library","my-library.html"],["◈ Analytics","analytics.html"],
    ["💳 Monetization","creator-monetization.html"],["❔ Help Center","help-center.html"],["🧭 Full Journey","navigation.html"],["☷ Site Map","site-map.html"]
  ];
  const button=document.createElement("button");
  button.className="cr-journey-launcher"; button.type="button"; button.setAttribute("aria-expanded","false");
  button.textContent="🧭 Journey";
  const panel=document.createElement("aside"); panel.className="cr-journey-panel"; panel.setAttribute("aria-label","CrowRules Podcasting Journey");
  panel.innerHTML='<button class="cr-journey-close" type="button" aria-label="Close journey menu">×</button><h2>Podcasting Journey</h2><p>Move anywhere in the CrowRules Podcasting ecosystem.</p><div class="cr-journey-grid"></div>';
  const grid=panel.querySelector(".cr-journey-grid");
  for(const [label,href] of links){const a=document.createElement("a");a.href=href;a.textContent=label;grid.appendChild(a);}
  const close=()=>{panel.classList.remove("open");button.setAttribute("aria-expanded","false");};
  button.addEventListener("click",()=>{const open=panel.classList.toggle("open");button.setAttribute("aria-expanded",String(open));});
  panel.querySelector(".cr-journey-close").addEventListener("click",close);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  document.body.append(button,panel);
})();