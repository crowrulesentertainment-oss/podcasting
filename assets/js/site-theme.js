/* CrowRules Podcasting member themes + platform featured theme runtime.
 * Personal preferences are stored per authenticated user; featured themes never overwrite them.
 */
(() => {
  "use strict";
  const CATALOG = window.CRP_THEME_CATALOG || {themes:[]};
  const THEMES = CATALOG.themes || [];
  const MEMBER_KEY = "crp_member_theme";
  const themeById = id => THEMES.find(t => t.id === id) || THEMES.find(t => t.id === "original") || THEMES[0];
  const valid = id => THEMES.some(t => t.id === id);
  let sb = null, currentUser = null, selectedId = "original", featuredId = "original";
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const easterDate = year => {const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(year,month-1,day)};
  const sameDayRange=(now,start,end)=>now>=start&&now<=end;
  function automaticTheme(now=new Date()){
    const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
    const easter=easterDate(y), easterStart=new Date(y,easter.getMonth(),easter.getDate()-4),easterEnd=new Date(y,easter.getMonth(),easter.getDate()+1);
    if(m===9)return "halloween";
    if(m===10&&d>=15&&d<=27)return "thanksgiving";
    if(m===11&&d<=25)return "christmas";
    if((m===11&&d>=26)||(m===0&&d<=2))return d>=26?"newyear":"new-years-day";
    if(m===1&&d<=14)return "valentines";
    if(m===2&&d>=10&&d<=17)return "st-patricks-day";
    if(sameDayRange(now,easterStart,easterEnd))return "easter";
    if(m===6&&d>=1&&d<=5)return "independence-day";
    if(m>=2&&m<=4)return "spring";
    if(m>=5&&m<=7)return "summer";
    if(m>=8&&m<=10)return "fall";
    return "winter";
  }
  function resolveFeatured(settings){
    if(!settings)return "original";
    const now=new Date();
    const windows=Array.isArray(settings.theme_schedule)?settings.theme_schedule:[];
    if(settings.theme_mode==="manual")return valid(settings.featured_theme)?settings.featured_theme:"original";
    const match=windows.find(w=>w&&valid(w.theme_id)&&w.start&&w.end&&now>=new Date(w.start+"T00:00:00")&&now<new Date(w.end+"T23:59:59"));
    if(settings.theme_mode==="scheduled")return match?match.theme_id:(valid(settings.featured_theme)?settings.featured_theme:"original");
    if(match)return match.theme_id;
    if(settings.seasonal_auto!==false)return automaticTheme(now);
    return valid(settings.featured_theme)?settings.featured_theme:"original";
  }
  function applyTheme(id){
    const theme=themeById(id)||themeById("original");
    if(!theme)return;
    const active=theme.id!=="original",root=document.documentElement;
    root.dataset.siteTheme=active?theme.id:"";
    document.body.dataset.siteTheme=active?theme.id:"";
    const vars={"--cr-site-accent":theme.accent,"--cr-site-glow":theme.glow,"--cr-site-panel":theme.panel,"--cr-site-ink":theme.ink,"--cr-site-muted":theme.muted,"--cr-site-scene":theme.photo?'url("'+theme.photo+'")':"none","--cr-site-hero":theme.hero?'url("'+theme.hero+'")':"none"};
    Object.entries(vars).forEach(([key,value])=>{if(active&&value&&value!=="none")root.style.setProperty(key,value);else root.style.removeProperty(key)});
    let snow=document.getElementById("crChristmasSnow");
    if(theme.id==="christmas"&&!snow){snow=document.createElement("div");snow.id="crChristmasSnow";snow.className="cr-christmas-snow";snow.setAttribute("aria-hidden","true");document.body.appendChild(snow)}
    else if(theme.id!=="christmas"&&snow)snow.remove();
    selectedId=theme.id;
    const status=document.getElementById("crMemberThemeStatus");if(status)status.textContent=theme.icon+" "+theme.label+" selected";
  }
  async function loadSettings(){
    try{
      const {data,error}=await sb.from("crp_site_settings").select("featured_theme,theme_mode,seasonal_auto,theme_schedule").eq("site_key","podcasting").maybeSingle();
      if(error)throw error;featuredId=resolveFeatured(data);return data;
    }catch(error){console.warn("[CrowRules themes] Featured theme unavailable:",error.message);featuredId=automaticTheme();return null}
  }
  async function loadPreference(){
    const local=(()=>{try{return localStorage.getItem(MEMBER_KEY)}catch{return null}})();
    if(currentUser){
      try{
        const {data,error}=await sb.from("crp_theme_preferences").select("theme_id").eq("user_id",currentUser.id).maybeSingle();
        if(error)throw error;
        if(data&&valid(data.theme_id))return data.theme_id;
        if(local&&valid(local)){
          const saved=await sb.from("crp_theme_preferences").upsert({user_id:currentUser.id,theme_id:local,updated_at:new Date().toISOString()},{onConflict:"user_id"});
          if(!saved.error)return local;
        }
      }catch(error){console.warn("[CrowRules themes] Member preference unavailable:",error.message)}
    }
    return local&&valid(local)?local:featuredId;
  }
  async function savePreference(id){
    if(!valid(id))return;
    try{localStorage.setItem(MEMBER_KEY,id)}catch{}
    applyTheme(id);
    const status=document.getElementById("crMemberThemeStatus");
    if(currentUser&&sb){
      const {error}=await sb.from("crp_theme_preferences").upsert({user_id:currentUser.id,theme_id:id,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(error){if(status)status.textContent="Theme applied on this device; account sync failed: "+error.message;return}
      if(status)status.textContent="Saved to your CrowRules account. Your theme stays yours when featured themes change.";
    }else if(status)status.textContent="Saved on this device. Sign in to sync your theme across devices.";
  }
  function mountMemberPicker(){
    if(document.body.dataset.page==="admin"||document.getElementById("crMemberThemeControl")||!THEMES.length)return;
    const css=document.createElement("style");css.id="cr-member-theme-css";css.textContent=`
      #crMemberThemeControl{position:fixed;z-index:9990;left:16px;bottom:18px;color:#fff;font:inherit}
      #crMemberThemeToggle{display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #ffffff2b;border-radius:999px;background:#111720ed;color:#fff;font-size:11px;font-weight:850;box-shadow:0 8px 28px #0008;cursor:pointer;backdrop-filter:blur(12px)}
      #crMemberThemeToggle:hover{border-color:#d8ad61}
      #crMemberThemePanel{position:absolute;left:0;bottom:50px;width:min(440px,calc(100vw - 28px));max-height:min(72vh,650px);overflow:auto;padding:14px;border:1px solid #ffffff25;border-radius:17px;background:linear-gradient(145deg,#171d28,#080c13);box-shadow:0 20px 60px #000b}
      #crMemberThemePanel[hidden]{display:none}
      #crMemberThemePanel h3{margin:0;font-size:16px}
      #crMemberThemePanel p{margin:4px 0 12px;color:#aeb9c8;font-size:10px;line-height:1.5}
      #crMemberThemeSearch{width:100%;margin-bottom:10px;padding:9px 10px;border:1px solid #ffffff24;border-radius:9px;background:#080c12;color:#fff;font:inherit;font-size:11px}
      #crMemberThemeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .cr-member-theme-card{overflow:hidden;padding:0;border:1px solid #ffffff20;border-radius:10px;background:#080c12;color:#fff;text-align:left;cursor:pointer}
      .cr-member-theme-card[aria-pressed=true]{border:2px solid #e2b66f}
      .cr-member-theme-card img{display:block;width:100%;height:74px;object-fit:cover;background:#222}
      .cr-member-theme-card span{display:block;padding:7px 8px;font-size:10px;font-weight:800;line-height:1.3}
      #crMemberThemeStatus{display:block;margin-top:10px;color:#b9c8d6;font-size:10px;line-height:1.5}
      @media(max-width:600px){#crMemberThemeControl{left:10px;bottom:12px}#crMemberThemeToggle{padding:9px 12px}#crMemberThemePanel{width:min(380px,calc(100vw - 20px));max-height:66vh}}
      @media(prefers-reduced-motion:reduce){#crMemberThemePanel *{transition:none!important}}
    `;document.head.appendChild(css);
    const host=document.createElement("div");host.id="crMemberThemeControl";host.innerHTML='<button id="crMemberThemeToggle" type="button" aria-expanded="false" aria-controls="crMemberThemePanel">🎨 <span>Choose your atmosphere</span></button><section id="crMemberThemePanel" hidden aria-label="Personal theme selector"><h3>Make CrowRules yours.</h3><p>Your personal theme is independent of the platform featured theme. It will not change when the seasonal environment updates.</p><input id="crMemberThemeSearch" type="search" placeholder="Find a cinematic world…" aria-label="Search themes"><div id="crMemberThemeGrid"></div><small id="crMemberThemeStatus" role="status" aria-live="polite"></small></section>';
    document.body.appendChild(host);
    const panel=document.getElementById("crMemberThemePanel"),toggle=document.getElementById("crMemberThemeToggle"),grid=document.getElementById("crMemberThemeGrid"),search=document.getElementById("crMemberThemeSearch");
    const render=()=>{const q=search.value.trim().toLowerCase();const list=THEMES.filter(t=>(t.label+" "+t.desc+" "+(t.collection||"")).toLowerCase().includes(q));grid.innerHTML=list.map(t=>'<button type="button" class="cr-member-theme-card" data-member-theme="'+esc(t.id)+'" aria-pressed="'+(selectedId===t.id)+'"><img loading="lazy" src="'+esc(t.photo||"")+'" alt=""><span>'+esc(t.icon+" "+t.label)+'</span></button>').join("")};
    toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden))});
    grid.addEventListener("click",e=>{const card=e.target.closest("[data-member-theme]");if(!card)return;savePreference(card.dataset.memberTheme).then(render)});
    search.addEventListener("input",render);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){panel.hidden=true;toggle.setAttribute("aria-expanded","false")}});
    render();
  }
  async function boot(){
    if(!THEMES.length)return;
    mountMemberPicker();
    try{
      const mod=await import("./client.js");sb=mod.sb;
      const {data:{user}}=await sb.auth.getUser();currentUser=user||null;
    }catch(error){console.warn("[CrowRules themes] Auth client unavailable:",error.message)}
    await loadSettings();
    const preference=await loadPreference();
    applyTheme(preference);
    const status=document.getElementById("crMemberThemeStatus");
    if(status&&currentUser)status.textContent="Signed in. Your personal theme can sync across devices.";
  }
  window.addEventListener("cr:site-theme-change",e=>{if(e.detail&&valid(e.detail))applyTheme(e.detail)});
  window.addEventListener("cr:featured-theme-published",async()=>{await loadSettings();if(!currentUser){applyTheme(featuredId)}else{const pref=await loadPreference();applyTheme(pref)}});
  window.addEventListener("storage",e=>{if(e.key===MEMBER_KEY&&valid(e.newValue))applyTheme(e.newValue)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  const style=document.createElement("style");style.id="cr-site-theme-styles";style.textContent=`
    html[data-site-theme]:not([data-site-theme=""]),body[data-site-theme]:not([data-site-theme=""]){color-scheme:dark}
    body[data-site-theme]:not([data-site-theme=""]){background-color:#080a0e!important;background-image:linear-gradient(180deg,rgba(5,8,13,.64),rgba(5,8,13,.92)),var(--cr-site-scene)!important;background-position:center,center 38%!important;background-size:cover!important;background-attachment:fixed!important;color:var(--cr-site-ink,#fff)!important}
    body[data-site-theme]:not([data-site-theme=""]) .topbar,body[data-site-theme]:not([data-site-theme=""]) .crp-nav{background:linear-gradient(100deg,var(--cr-site-panel),rgba(8,10,14,.97))!important;border-bottom:1px solid color-mix(in srgb,var(--cr-site-accent) 42%,transparent)!important;box-shadow:0 8px 34px rgba(0,0,0,.34)!important}
    body[data-site-theme]:not([data-site-theme=""]) .hero{background-image:linear-gradient(90deg,rgba(5,8,13,.94),rgba(5,8,13,.62) 55%,rgba(5,8,13,.18)),linear-gradient(0deg,#080a0e,transparent 48%),var(--cr-site-hero)!important;background-color:#080a0e!important}
    body[data-site-theme]:not([data-site-theme=""]) .page-hero{background:radial-gradient(ellipse at 78% 0%,color-mix(in srgb,var(--cr-site-accent) 24%,transparent),transparent 46%),linear-gradient(135deg,var(--cr-site-panel),rgba(8,10,14,.96))!important}
    body[data-site-theme]:not([data-site-theme=""]) .card,body[data-site-theme]:not([data-site-theme=""]) .panel,body[data-site-theme]:not([data-site-theme=""]) .stat,body[data-site-theme]:not([data-site-theme=""]) .tile,body[data-site-theme]:not([data-site-theme=""]) .sidebar,body[data-site-theme]:not([data-site-theme=""]) .auth-card{background:linear-gradient(145deg,var(--cr-site-panel),rgba(9,12,17,.96))!important;border-color:color-mix(in srgb,var(--cr-site-accent) 28%,rgba(255,255,255,.08))!important;box-shadow:0 14px 36px rgba(0,0,0,.24)!important}
    body[data-site-theme]:not([data-site-theme=""]) .eyebrow,body[data-site-theme]:not([data-site-theme=""]) .hero h1 em,body[data-site-theme]:not([data-site-theme=""]) .section-head h2,body[data-site-theme]:not([data-site-theme=""]) .page-title,body[data-site-theme]:not([data-site-theme=""]) .rank-num{color:var(--cr-site-accent)!important}
    body[data-site-theme]:not([data-site-theme=""]) .btn:not(.secondary),body[data-site-theme]:not([data-site-theme=""]) button:not(.secondary):not(.menu-toggle){background:linear-gradient(135deg,color-mix(in srgb,var(--cr-site-accent) 65%,#171717),var(--cr-site-accent))!important;border-color:var(--cr-site-accent)!important;color:#111!important}
    body[data-site-theme]:not([data-site-theme=""]) input,body[data-site-theme]:not([data-site-theme=""]) select,body[data-site-theme]:not([data-site-theme=""]) textarea{background:rgba(8,11,16,.9)!important;border-color:color-mix(in srgb,var(--cr-site-accent) 30%,transparent)!important;color:var(--cr-site-ink)!important}
    body[data-site-theme]:not([data-site-theme=""]) .muted,body[data-site-theme]:not([data-site-theme=""]) .card p,body[data-site-theme]:not([data-site-theme=""]) .page-hero p{color:var(--cr-site-muted)!important}
    body[data-site-theme="christmas"] .topbar,body[data-site-theme="christmas"] .crp-nav{border-bottom-color:rgba(232,199,123,.42)!important}
    .cr-christmas-snow{position:fixed;inset:0;z-index:9988;overflow:hidden;pointer-events:none;opacity:.55}
    .cr-christmas-snow:before,.cr-christmas-snow:after{content:"";position:absolute;inset:-100vh 0 0;background-repeat:repeat;background-size:320px 320px;background-image:radial-gradient(2px 2px at 24px 38px,rgba(255,255,255,.95) 98%,transparent),radial-gradient(1.5px 1.5px at 116px 92px,rgba(255,255,255,.82) 98%,transparent),radial-gradient(2.5px 2.5px at 218px 164px,rgba(226,244,255,.88) 98%,transparent);animation:crChristmasFall 22s linear infinite}
    .cr-christmas-snow:after{background-size:460px 460px;background-position:90px 40px;opacity:.48;filter:blur(1px);animation:crChristmasFall 32s linear infinite}
    @keyframes crChristmasFall{from{transform:translate3d(0,-15vh,0)}to{transform:translate3d(-5vw,100vh,0)}}
    @media(max-width:760px){body[data-site-theme]:not([data-site-theme=""]){background-attachment:scroll!important}.cr-christmas-snow{opacity:.38}}
    @media(prefers-reduced-motion:reduce){body[data-site-theme] *{scroll-behavior:auto!important;transition:none!important;animation-duration:.01ms!important}.cr-christmas-snow{display:none!important}}
  `;document.head.appendChild(style);
})();