(()=>{
'use strict';
const SRC='https://crowrulesentertainment-oss.github.io/podcasting/js/podcasting-core-v8-fixed.js?v=20261004-8';
function load(){if(document.querySelector('script[data-crow-v8-core]'))return;const s=document.createElement('script');s.src=SRC;s.defer=true;s.dataset.crowV8Core='true';document.head.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
