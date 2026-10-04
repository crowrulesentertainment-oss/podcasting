(()=>{
'use strict';
const p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
if(p==='index.html'||p==='launch.html')return;
const SRC='https://crowrulesentertainment-oss.github.io/podcasting/js/podcasting-v10.js?v=20261004-10';
function load(){if(document.querySelector('script[data-crow-v10-core]'))return;const s=document.createElement('script');s.src=SRC;s.defer=true;s.dataset.crowV10Core='true';document.head.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
