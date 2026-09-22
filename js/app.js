const path=location.pathname.split("/").pop()||"index.html";
const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* 5.76 additions are appended by the existing application build. */
