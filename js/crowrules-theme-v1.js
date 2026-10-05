(()=>{"use strict";
if(window.__CROW_THEME_V1__)return;window.__CROW_THEME_V1__=true;
const KEY="crowrules-podcasting-site-theme-v1";
const THEMES=["cyberpunk","midnight","neon","crimson","ice","matrix","light"];
function apply(value,save=true){
 const t=THEMES.includes(value)?value:"cyberpunk";
 document.documentElement.dataset.crowTheme=t;
 document.body?.setAttribute("data-crow-theme",t);
 window.CROW_SITE_THEME_CURRENT=t;
 if(save)try{localStorage.setItem(KEY,t)}catch(_){}
 if(save&&window.CROW_SUPABASE&&window.__CROW_USER){
  clearTimeout(window.__CROW_THEME_SAVE);
  window.__CROW_THEME_SAVE=setTimeout(()=>window.CROW_SUPABASE.auth.updateUser({data:{podcasting_theme:t}}).catch(()=>{}),250);
 }
 window.dispatchEvent(new CustomEvent("crow:theme-changed",{detail:{theme:t}}));
 return t;
}
function get(){
 let t="";
 try{t=localStorage.getItem(KEY)||""}catch(_){}
 if(!t&&window.__CROW_USER)t=window.__CROW_USER.user_metadata?.podcasting_theme||"";
 return apply(t||"cyberpunk",false);
}
window.CROW_SITE_THEME={get,set:apply,allowed:THEMES};
window.addEventListener("storage",e=>{if(e.key===KEY&&e.newValue)apply(e.newValue,false)});
window.addEventListener("crow:auth",e=>{
 const remote=e.detail?.user?.user_metadata?.podcasting_theme;
 if(remote&&THEMES.includes(remote)){try{localStorage.setItem(KEY,remote)}catch(_){}apply(remote,false)}
});
const boot=()=>get();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();