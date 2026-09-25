/* CrowRules Podcasting 5.1 — platform-wide interaction layer */
(()=>{"use strict";
const enhance=()=>{
 document.documentElement.classList.add("cr-ready");
 document.querySelectorAll("img").forEach(i=>{i.loading=i.loading||"lazy";i.decoding="async"});
 if(document.getElementById("crCommand"))return;
 const m=document.createElement("div");m.id="crCommand";m.className="command-palette";m.hidden=true;
 m.innerHTML='<div class="command-backdrop" data-command-close></div><section class="command-panel" role="dialog" aria-modal="true" aria-label="CrowRules command palette"><input id="crCommandInput" placeholder="Jump to a page…" autocomplete="off"><div id="crCommandList"></div></section>';
 document.body.append(m);
 const items=[["Home","home.html"],["Discover","discover.html"],["Charts","charts.html"],["Live","live.html"],["Library","library.html"],["Creator Studio","studio.html"],["Create Podcast","create-podcast.html"],["Add Episode","add-episode.html"],["Live Production Studio","live-production.html"],["Analytics","analytics.html"],["Subscriptions","subscriptions.html"],["Account","account.html"],["Admin","admin.html"]];
 const list=m.querySelector("#crCommandList"),input=m.querySelector("#crCommandInput");
 const render=q=>list.innerHTML=items.filter(x=>x[0].toLowerCase().includes(q.toLowerCase())).map(x=>'<a class="command-item" href="'+x[1]+'"><span>'+x[0]+'</span><small>↵</small></a>').join("");
 const open=()=>{m.hidden=false;input.value="";render("");input.focus()},close=()=>m.hidden=true;render("");
 document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open()}if(e.key==="Escape"&&!m.hidden)close()});
 m.addEventListener("click",e=>{if(e.target.closest("[data-command-close]"))close()});input.addEventListener("input",()=>render(input.value));
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});else enhance();
})();