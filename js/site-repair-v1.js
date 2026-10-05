/* CrowRules Podcasting — Site Repair Guard V3.0 */
(()=>{"use strict";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";const p=()=>location.pathname.split('/').pop().toLowerCase();const skip=()=>p()==='index.html'||p()==='launch.html';
const hide=el=>{if(!el)return;el.classList.remove('loading','is-loading','active');el.setAttribute('aria-hidden','true');el.style.setProperty('display','none','important')};
function repair(){
  if(skip())return;
  document.querySelectorAll('#loadingScreen,#loading-screen,#pageLoading,.loading-screen,.page-loading,.app-loading,[data-loading-screen]').forEach(hide);
  // V14.10 is the sole runtime. The retired V10 runtime is never injected.
}
function launchClean(){if(p()!=='launch.html')return;document.querySelectorAll('[data-nav],.crv8,.crv8search,.cr9-shell,.cr9-wall,.cr10-nav,.cr10-wall,.top nav,.top .links').forEach(x=>x.remove());if(!document.getElementById('crow-launch-no-nav')){const s=document.createElement('style');s.id='crow-launch-no-nav';s.textContent='[data-nav],.crv8,.crv8search,.cr9-shell,.cr9-wall,.cr10-nav,.cr10-wall,.top nav,.top .links{display:none!important}';document.head.appendChild(s)}}
function boot(){launchClean();repair();window.addEventListener('crow:podcasting-ready',repair);window.addEventListener('crow:auth-changed',repair);window.addEventListener('online',repair);if(p()==='launch.html')new MutationObserver(launchClean).observe(document.documentElement,{childList:true,subtree:true});setTimeout(repair,1000);setTimeout(repair,5000);setTimeout(repair,12000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
