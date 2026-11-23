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
  let sb = null, currentUser = null, selectedId = "original", savedId = "original", draftId = "original", featuredId = "original";
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
  // Seasonal scene bank: every destination page receives a different real-world photograph
  // from the selected holiday/season collection, while the theme palette remains unchanged.
  const SEASONAL_SCENES={"christmas":["https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=90"],"thanksgiving":["https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=92"],"halloween":["https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1475738198235-4b30fcf6a3b9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90"],"newyear":["https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90"],"new-years-day":["https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90"],"valentines":["https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90"],"easter":["https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=2400&q=85"],"st-patricks-day":["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90"],"independence-day":["https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90"],"mothers-day":["https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=2400&q=85"],"fathers-day":["https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90"],"spring":["https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90"],"summer":["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2400&q=90"],"fall":["https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1475738198235-4b30fcf6a3b9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90"],"winter":["https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=92","https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85","https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85"],"original":["https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=90"]};
  const PAGE_SCENE_INDEX={"home":0,"discover":1,"show":2,"episode":3,"creator":4,"studio":5,"community":6,"messages":7,"account":8,"profile":9,"reviews":10,"events":11,"admin":12,"rankings":13,"search":14,"notifications":15};
  function pageScene(theme){
    const page=String(document.body.dataset.page||"").toLowerCase();
    const path=String(location.pathname||"").toLowerCase();
    const key=page+" "+path;
    const pageKey=/admin|control-room|moderation/.test(key)?"admin":/discover|search|explore|directory/.test(key)?"discover":/episode|listen|player/.test(key)?"episode":/show|podcast|series/.test(key)?"show":/creator/.test(key)?"creator":/studio|record|upload/.test(key)?"studio":/community|group|member|hub/.test(key)?"community":/message|inbox|chat/.test(key)?"messages":/account|setting|login|signup|auth/.test(key)?"account":/profile|people|host/.test(key)?"profile":/review|feedback|rating/.test(key)?"reviews":/event|calendar|live/.test(key)?"events":/rank/.test(key)?"rankings":/search/.test(key)?"search":/notification/.test(key)?"notifications":(page==="home"||path.endsWith("/podcasting/")||path.endsWith("/index.html"))?"home":"show";
    const mobile=window.matchMedia?.("(max-width: 760px)")?.matches===true;
    const customDesktop=theme.heroCustom===true&&theme.hero?theme.hero:"";
    const customMobile=theme.mobileHero||customDesktop;
    if(mobile&&customMobile)return customMobile;
    if(customDesktop)return customDesktop;
    const ids=SEASONAL_SCENES[theme.id]||SEASONAL_SCENES.original;
    const index=PAGE_SCENE_INDEX[pageKey]??0;
    return ids[index%ids.length]||theme.photo||theme.hero||"";
  }
  function applyTheme(id){
    const theme=themeById(id)||themeById("original");
    const scene=pageScene(theme);
    if(!theme)return;
    const active=true,root=document.documentElement;
    root.dataset.siteTheme=active?theme.id:"";
    document.body.dataset.siteTheme=active?theme.id:"";
    const vars={"--cr-site-accent":theme.accent,"--cr-site-glow":theme.glow,"--cr-site-panel":theme.panel,"--cr-site-ink":theme.ink,"--cr-site-muted":theme.muted,"--cr-site-scene":scene?'url("'+scene+'")':"none","--cr-site-hero":scene?'url("'+scene+'")':"none"};
    Object.entries(vars).forEach(([key,value])=>{if(active&&value&&value!=="none")root.style.setProperty(key,value);else root.style.removeProperty(key)});
    let snow=document.getElementById("crChristmasSnow");
    if(theme.id==="christmas"&&!snow){snow=document.createElement("div");snow.id="crChristmasSnow";snow.className="cr-christmas-snow";snow.setAttribute("aria-hidden","true");document.body.appendChild(snow)}
    else if(theme.id!=="christmas"&&snow)snow.remove();
    selectedId=theme.id;
    const status=document.getElementById("crMemberThemeStatus");if(status)status.textContent=theme.icon+" "+theme.label+" selected";
  }
  function applyCatalogOverrides(raw){
    const map=raw&&typeof raw==="object"&&!Array.isArray(raw)?(raw.themes||raw):{};
    THEMES.forEach(theme=>{
      const entry=map[theme.id];if(!entry||typeof entry!=="object")return;
      ["photo","hero","mobileHero","imageAlt"].forEach(key=>{if(typeof entry[key]==="string"&&entry[key])theme[key]=entry[key]});if(entry.heroCustom===true)theme.heroCustom=true;
    });
  }
  async function loadSettings(){
    try{
      const {data,error}=await sb.from("crp_site_settings").select("featured_theme,theme_mode,seasonal_auto,theme_schedule,theme_catalog").eq("site_key","podcasting").maybeSingle();
      if(error)throw error;applyCatalogOverrides(data?.theme_catalog);featuredId=resolveFeatured(data);return data;
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
    savedId=id;
    applyTheme(id);
    const status=document.getElementById("crMemberThemeStatus");
    if(currentUser&&sb){
      const {error}=await sb.from("crp_theme_preferences").upsert({user_id:currentUser.id,theme_id:id,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(error){if(status)status.textContent="Saved on this device, but account sync failed: "+error.message;return true}
      if(status)status.textContent="Saved to your CrowRules account. Your theme stays yours when featured themes change.";
    }else if(status)status.textContent="Saved on this device. Sign in to sync your theme across devices.";
    return true;
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
      #crMemberThemeActions{display:flex;gap:8px;margin-top:12px;position:sticky;bottom:-14px;padding:10px 0 2px;background:linear-gradient(180deg,transparent,#0c111b 22%)}
      #crMemberThemeActions button{flex:1;min-height:38px;padding:8px 10px;border:1px solid #ffffff2b;border-radius:9px;background:#ffffff0c;color:#fff;font:inherit;font-size:10px;font-weight:850;cursor:pointer}
      #crMemberThemeActions #crMemberThemeSave{border-color:#e2b66f;background:linear-gradient(120deg,#a66b37,#e2b66f);color:#17110a}
      #crMemberThemeActions button:disabled{opacity:.55;cursor:wait}
      #crMemberThemeStatus{display:block;margin-top:10px;color:#b9c8d6;font-size:10px;line-height:1.5}
      @media(max-width:600px){#crMemberThemeControl{left:10px;bottom:12px}#crMemberThemeToggle{padding:9px 12px}#crMemberThemePanel{width:min(380px,calc(100vw - 20px));max-height:66vh}}
      @media(prefers-reduced-motion:reduce){#crMemberThemePanel *{transition:none!important}}
    `;document.head.appendChild(css);
    const host=document.createElement("div");host.id="crMemberThemeControl";host.innerHTML='<button id="crMemberThemeToggle" type="button" aria-expanded="false" aria-controls="crMemberThemePanel">🎨 <span>Choose your atmosphere</span></button><section id="crMemberThemePanel" hidden aria-label="Personal theme selector"><h3>Make CrowRules yours.</h3><p>Your personal theme is independent of the platform featured theme. It will not change when the seasonal environment updates.</p><input id="crMemberThemeSearch" type="search" placeholder="Find a cinematic world…" aria-label="Search themes"><div id="crMemberThemeGrid"></div><div id="crMemberThemeActions"><button id="crMemberThemePreview" type="button">Preview</button><button id="crMemberThemeSave" type="button">Save my theme</button></div><small id="crMemberThemeStatus" role="status" aria-live="polite">Choose a theme, preview it, then save your selection.</small></section>';
    document.body.appendChild(host);
    const panel=document.getElementById("crMemberThemePanel"),toggle=document.getElementById("crMemberThemeToggle"),grid=document.getElementById("crMemberThemeGrid"),search=document.getElementById("crMemberThemeSearch");
    const render=()=>{const q=search.value.trim().toLowerCase();const list=THEMES.filter(t=>(t.label+" "+t.desc+" "+(t.collection||"")).toLowerCase().includes(q));grid.innerHTML=list.map(t=>'<button type="button" class="cr-member-theme-card" data-member-theme="'+esc(t.id)+'" aria-pressed="'+(draftId===t.id)+'"><img loading="lazy" src="'+esc(t.photo||"")+'" alt=""><span>'+esc(t.icon+" "+t.label)+'</span></button>').join("");const save=document.getElementById("crMemberThemeSave");if(save)save.disabled=draftId===savedId};
    toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;if(!panel.hidden){draftId=savedId;render()}toggle.setAttribute("aria-expanded",String(!panel.hidden))});
    grid.addEventListener("click",e=>{const card=e.target.closest("[data-member-theme]");if(!card)return;draftId=card.dataset.memberTheme;const status=document.getElementById("crMemberThemeStatus");if(status)status.textContent="Selected "+themeById(draftId).label+". Preview or save to apply it.";render()});
    document.getElementById("crMemberThemePreview").addEventListener("click",()=>{applyTheme(draftId);const status=document.getElementById("crMemberThemeStatus");if(status)status.textContent="Previewing "+themeById(draftId).label+". Save my theme to keep this choice."});
    document.getElementById("crMemberThemeSave").addEventListener("click",async()=>{const button=document.getElementById("crMemberThemeSave");button.disabled=true;button.textContent="Saving…";const ok=await savePreference(draftId);button.textContent=ok?"Saved":"Save my theme";render()});
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
    savedId=preference;draftId=preference;applyTheme(preference);
    const status=document.getElementById("crMemberThemeStatus");
    if(status&&currentUser)status.textContent="Signed in. Your personal theme can sync across devices.";
  }
  window.addEventListener("cr:site-theme-change",e=>{if(e.detail&&valid(e.detail))applyTheme(e.detail)});
  window.addEventListener("cr:page-changed",()=>applyTheme(selectedId));
  window.addEventListener("cr:featured-theme-published",async()=>{await loadSettings();if(!currentUser){applyTheme(featuredId)}else{const pref=await loadPreference();applyTheme(pref)}});
  window.addEventListener("storage",e=>{if(e.key===MEMBER_KEY&&valid(e.newValue))applyTheme(e.newValue)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  const style=document.createElement("style");style.id="cr-site-theme-styles";style.textContent=`
    html[data-site-theme]:not([data-site-theme=""]),body[data-site-theme]:not([data-site-theme=""]){color-scheme:dark}
    body[data-site-theme]:not([data-site-theme=""]){background-color:#080a0e!important;background-image:linear-gradient(180deg,rgba(5,8,13,.64),rgba(5,8,13,.92)),var(--cr-site-scene)!important;background-position:center,center 38%!important;background-size:cover!important;background-attachment:fixed!important;color:var(--cr-site-ink,#fff)!important}
    body[data-site-theme]:not([data-site-theme=""]) .topbar,body[data-site-theme]:not([data-site-theme=""]) .crp-nav{background:linear-gradient(100deg,var(--cr-site-panel),rgba(8,10,14,.97))!important;border-bottom:1px solid color-mix(in srgb,var(--cr-site-accent) 42%,transparent)!important;box-shadow:0 8px 34px rgba(0,0,0,.34)!important}
    body[data-site-theme]:not([data-site-theme=""]) .hero{background-image:linear-gradient(90deg,rgba(5,8,13,.94),rgba(5,8,13,.62) 55%,rgba(5,8,13,.18)),linear-gradient(0deg,#080a0e,transparent 48%),var(--cr-site-hero)!important;background-color:#080a0e!important}
    body[data-site-theme]:not([data-site-theme=""]) .page-hero{background-image:linear-gradient(90deg,rgba(5,8,13,.88),rgba(5,8,13,.58)),linear-gradient(0deg,rgba(8,10,14,.8),transparent),var(--cr-site-hero)!important;background-position:center,center,center 42%!important;background-size:cover!important;border:1px solid color-mix(in srgb,var(--cr-site-accent) 26%,transparent)!important}
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