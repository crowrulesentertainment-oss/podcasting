(()=>{
'use strict';
if(window.__CROW_PODCASTING_V8_FIXED__)return;
const src='https://crowrulesentertainment-oss.github.io/podcasting/js/podcasting-core-v8-fixed.js?v=20261004-8';
if(!document.querySelector('script[data-crow-v8-core]')){const s=document.createElement('script');s.src=src;s.defer=true;s.dataset.crowV8Core='true';document.head.appendChild(s)}
})();
