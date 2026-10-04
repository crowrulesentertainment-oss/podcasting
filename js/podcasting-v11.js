(()=>{
'use strict';
const p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
if(p==='index.html'||p==='launch.html'||window.__CROW_PODCASTING_V11__)return;
window.__CROW_PODCASTING_V11__=true;
const BASE='https://crowrulesentertainment-oss.github.io/podcasting/';
const V11='11.0.0';
function load(src,attr){return new Promise((resolve,reject)=>{if(document.querySelector(`script[${attr}]`))return resolve();const s=document.createElement('script');s.src=src;s.defer=true;s.setAttribute(attr,'true');s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
function css(){if(document.getElementById('cr11css'))return;const l=document.createElement('link');l.id='cr11css';l.rel='stylesheet';l.href=BASE+'css/podcasting-v11.css?v=20261004-11';document.head.appendChild(l)}
function enhance(){
 css();
 document.documentElement.dataset.crowVersion=V11;
 const nav=document.getElementById('cr10nav');
 if(nav&&!document.getElementById('cr11Tools')){
  const bar=nav.querySelector('.cr10-bar');
  const tools=document.createElement('div');tools.id='cr11Tools';tools.className='cr11-tools';
  tools.innerHTML='<button class="cr11-icon" id="cr11Command" aria-label="Open command center">⌘</button><button class="cr11-icon" id="cr11Top" aria-label="Back to top">↑</button>';
  bar?.appendChild(tools);
  document.getElementById('cr11Command').onclick=command;
  document.getElementById('cr11Top').onclick=()=>scrollTo({top:0,behavior:'smooth'});
 }
 if(!document.getElementById('cr11Crumb')){const main=document.querySelector('main');if(main){const b=document.createElement('div');b.id='cr11Crumb';b.className='cr11-crumb';const title=(document.title||'CrowRules Podcasting').replace(/\s*[-|].*$/,'');b.innerHTML='<span>CROWRULES</span><b>/</b><strong>'+escapeHtml(title)+'</strong>';main.prepend(b)}}
 if(!document.getElementById('cr11Live')){const x=document.createElement('div');x.id='cr11Live';x.innerHTML='<span></span><b>NETWORK ONLINE</b><small> CROW / PODCASTING V11</small>';document.body.appendChild(x)}
 window.addEventListener('scroll',()=>document.getElementById('cr11Top')?.classList.toggle('show',scrollY>500),{passive:true});
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();command()}if(e.key==='Escape')document.getElementById('cr11CommandPanel')?.remove()});
}
function escapeHtml(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function command(){
 if(document.getElementById('cr11CommandPanel'))return document.getElementById('cr11CommandPanel').remove();
 const panel=document.createElement('div');panel.id='cr11CommandPanel';panel.className='cr11-command';
 const items=[['Home','home.html'],['Podcasts','podcasts.html'],['Discover','discover.html'],['Episodes','episodes.html'],['Search','search.html'],['Link Wall','link-wall.html'],['Account','account.html'],['Membership','membership.html'],['Creator Center','creator-center.html'],['Subscriptions & Prices','creator-subscriptions.html'],['Analytics','creator-analytics.html'],['Admin Center','admin.html']];
 panel.innerHTML='<div class="cr11-command-card"><div class="cr11-kicker">CROWRULES COMMAND CENTER</div><input id="cr11Q" autofocus placeholder="Search pages, creators, podcasts…"><div id="cr11Results">'+items.map((x,i)=>'<a href="'+x[1]+'" data-cmd>'+x[0]+'<kbd>'+(i+1)+'</kbd></a>').join('')+'</div><p>CTRL / CMD + K · ESC TO CLOSE</p></div>';
 document.body.appendChild(panel);const q=panel.querySelector('#cr11Q');q.oninput=()=>{const v=q.value.toLowerCase();panel.querySelectorAll('[data-cmd]').forEach(a=>a.hidden=!a.textContent.toLowerCase().includes(v))};panel.onclick=e=>{if(e.target===panel)panel.remove()};
}
async function start(){css();try{await load(BASE+'js/podcasting-v10.js?v=20261004-10','data-crow-v10-core');setTimeout(enhance,50)}catch(e){console.error('CrowRules V11 bootstrap failed',e);enhance()}}
start();
})();
