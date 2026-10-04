(()=>{
'use strict';
if((location.pathname.split('/').pop()||'index.html').toLowerCase()==='index.html'||location.pathname.split('/').pop().toLowerCase()==='launch.html')return;
if(document.querySelector('script[data-crow-v9-core]'))return;
const s=document.createElement('script');s.src='https://crowrulesentertainment-oss.github.io/podcasting/js/podcasting-core-v9.js?v=20261004-9';s.defer=true;s.dataset.crowV9Core='true';document.head.appendChild(s);
})();
