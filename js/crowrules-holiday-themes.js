/* CrowSpace Animated Holiday Theme Engine
   One shared loader for every CrowSpace page. */
(function(){
  "use strict";
  const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
  const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
  const FALLBACKS=[
    {name:"Halloween",slug:"halloween",starts_on:"2026-10-01",ends_on:"2026-10-31",accent_color:"#ff7a18",secondary_color:"#8b2cff",css_class:"holiday-halloween"},
    {name:"Thanksgiving",slug:"thanksgiving",starts_on:"2026-11-01",ends_on:"2026-11-30",accent_color:"#d9903d",secondary_color:"#7b3f20",css_class:"holiday-thanksgiving"},
    {name:"Christmas",slug:"christmas",starts_on:"2026-12-01",ends_on:"2026-12-25",accent_color:"#ff335f",secondary_color:"#36d66b",css_class:"holiday-christmas"},
    {name:"New Year's Eve",slug:"new-years-eve",starts_on:"2026-12-26",ends_on:"2026-12-31",accent_color:"#ffd166",secondary_color:"#8b5cf6",css_class:"holiday-new-years-eve"},
    {name:"New Year's Day",slug:"new-years-day",starts_on:"2027-01-01",ends_on:"2027-01-01",accent_color:"#ffd166",secondary_color:"#20e6ff",css_class:"holiday-new-years-day"},
    {name:"Valentine's Day",slug:"valentines",starts_on:"2027-02-01",ends_on:"2027-02-14",accent_color:"#ff4f9a",secondary_color:"#ff2d55",css_class:"holiday-valentines"},
    {name:"Spring",slug:"spring",starts_on:"2027-03-01",ends_on:"2027-05-31",accent_color:"#7ee787",secondary_color:"#ff8bd1",css_class:"season-spring"},
    {name:"Summer",slug:"summer",starts_on:"2027-06-01",ends_on:"2027-08-31",accent_color:"#ffd166",secondary_color:"#20e6ff",css_class:"season-summer"},
    {name:"Fall",slug:"fall",starts_on:"2027-09-01",ends_on:"2027-11-30",accent_color:"#ff8c42",secondary_color:"#d94841",css_class:"season-fall"}
  ];
  const CSS=`
#cr-holiday-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden}
.cr-holiday-particle{position:absolute;top:-12vh;left:0;will-change:transform,opacity;animation:crHolidayFall linear infinite;opacity:.85}
@keyframes crHolidayFall{0%{transform:translate3d(var(--x),-12vh,0) rotate(0deg);opacity:0}10%{opacity:.9}90%{opacity:.8}100%{transform:translate3d(calc(var(--x) + var(--drift)),112vh,0) rotate(var(--rot));opacity:0}}
#cr-holiday-banner{position:fixed;right:16px;bottom:16px;z-index:2147483001;max-width:min(360px,calc(100vw - 32px));padding:12px 15px;border:1px solid color-mix(in srgb,var(--cr-holiday-accent,#20e6ff),white 15%);border-radius:14px;background:color-mix(in srgb,#080b14,transparent 8%);backdrop-filter:blur(14px);box-shadow:0 12px 35px #0008;color:#fff;font:600 13px Arial,sans-serif;display:flex;gap:10px;align-items:center}
#cr-holiday-banner .cr-holiday-icon{font-size:20px}
#cr-holiday-banner button{margin-left:auto;border:1px solid #ffffff22;background:#ffffff12;color:#fff;border-radius:8px;padding:5px 8px;cursor:pointer}
body.cr-holiday-active{--cr-holiday-accent:#20e6ff;--cr-holiday-secondary:#8b5cf6}
body.cr-holiday-active a{transition:color .2s, text-shadow .2s}
body.cr-holiday-active a:hover{color:var(--cr-holiday-accent)!important;text-shadow:0 0 12px color-mix(in srgb,var(--cr-holiday-accent),transparent 45%)}
body.cr-holiday-halloween{--cr-holiday-accent:#ff7a18;--cr-holiday-secondary:#8b2cff}
body.cr-holiday-thanksgiving{--cr-holiday-accent:#d9903d;--cr-holiday-secondary:#7b3f20}
body.cr-holiday-christmas{--cr-holiday-accent:#ff335f;--cr-holiday-secondary:#36d66b}
body.cr-holiday-new-years-eve,body.cr-holiday-new-years-day{--cr-holiday-accent:#ffd166;--cr-holiday-secondary:#8b5cf6}
body.cr-holiday-valentines{--cr-holiday-accent:#ff4f9a;--cr-holiday-secondary:#ff2d55}
body.cr-season-spring{--cr-holiday-accent:#7ee787;--cr-holiday-secondary:#ff8bd1}
body.cr-season-summer{--cr-holiday-accent:#ffd166;--cr-holiday-secondary:#20e6ff}
body.cr-season-fall{--cr-holiday-accent:#ff8c42;--cr-holiday-secondary:#d94841}
body.cr-holiday-active .card,body.cr-holiday-active .panel,body.cr-holiday-active .shortcut{border-color:color-mix(in srgb,var(--cr-holiday-accent),#292e42 75%)}
.cr-holiday-settings{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.cr-holiday-settings select{background:#080a12;color:#fff;border:1px solid #343c56;border-radius:9px;padding:8px}
.cr-holiday-label{color:var(--cr-holiday-accent,#20e6ff);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
@media(prefers-reduced-motion:reduce){#cr-holiday-layer{display:none!important}.cr-holiday-particle{animation:none!important}}
@media(max-width:600px){#cr-holiday-banner{right:9px;bottom:9px}}
`;
  const ICONS={halloween:"🎃",thanksgiving:"🦃",christmas:"🎄","new-years-eve":"🎆","new-years-day":"🥂",valentines:"💕",spring:"🌸",summer:"☀️",fall:"🍂"};
  function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function injectCss(){if(document.getElementById("cr-holiday-css"))return;const s=document.createElement("style");s.id="cr-holiday-css";s.textContent=CSS;document.head.appendChild(s)}
  function stored(){try{return localStorage.getItem("crowspace_holiday_mode")||"automatic"}catch(e){return"automatic"}}
  function save(v){try{localStorage.setItem("crowspace_holiday_mode",v)}catch(e){}}
  async function getMode(db){
    let mode=stored();
    try{
      const s=await db.auth.getSession();
      if(s.data.session){
        const r=await db.from("crowspace_holiday_preferences").select("mode").eq("user_id",s.data.session.user.id).maybeSingle();
        if(!r.error&&r.data?.mode){mode=r.data.mode;save(mode)}
      }
    }catch(e){}
    return mode;
  }
  async function persistMode(db,v){
    save(v);
    try{
      const s=await db.auth.getSession();
      if(s.data.session) await db.from("crowspace_holiday_preferences").upsert({user_id:s.data.session.user.id,mode:v,updated_at:new Date().toISOString()});
    }catch(e){}
  }
  async function themes(){
    if(!window.supabase)return FALLBACKS;
    try{
      const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      const r=await db.from("crowrules_holiday_calendar").select("name,slug,starts_on,ends_on,background_url,accent_color,secondary_color,css_class,particle_set,is_active,priority").eq("is_active",true).order("priority",{ascending:true}).order("starts_on",{ascending:false});
      if(!r.error&&r.data&&r.data.length)return r.data;
    }catch(e){}
    return FALLBACKS;
  }
  function activeTheme(list){
    const t=today();
    const exact=list.find(x=>x.starts_on<=t&&x.ends_on>=t);
    if(exact)return exact;
    const md=t.slice(5);
    const y=t.slice(0,4);
    const fallback=FALLBACKS.slice().sort((a,b)=>(["spring","summer","fall"].includes(a.slug)?0:1)-(["spring","summer","fall"].includes(b.slug)?0:1)).find(x=>{
      const s=x.starts_on.slice(5),e=x.ends_on.slice(5);
      return s<=e?s<=md&&md<=e:md>=s||md<=e;
    });
    return fallback?{...fallback,starts_on:y+"-"+fallback.starts_on.slice(5),ends_on:y+"-"+fallback.ends_on.slice(5)}:null;
  }
  function particle(theme){
    const layer=document.getElementById("cr-holiday-layer");if(!layer)return;
    layer.innerHTML="";
    const base=theme.slug.replace(/-\d{4}$/,"");
    const set=theme.particle_set||base; const count=set==="christmas"?46:set==="halloween"?34:set==="new-years"?26:24;
    let glyphs;
    switch(set){
      case"halloween":glyphs=["🦇","✦","🍂"];break;
      case"thanksgiving":glyphs=["🍂","🍁","🌰"];break;
      case"christmas":glyphs=["❄","✦","❅","🎄"];break;
      case"new-years-eve":case"new-years-day":glyphs=["✦","✧","✨"];break;
      case"valentines":glyphs=["♥","♡","💕"];break;
      case"spring":glyphs=["🌸","✿","❀"];break;
      case"summer":glyphs=["✦","·","☀"];break;
      default:glyphs=["🍂","🍁","✦"];
    }
    for(let i=0;i<count;i++){
      const p=document.createElement("span");p.className="cr-holiday-particle";p.textContent=glyphs[i%glyphs.length];
      p.style.setProperty("--x",(Math.random()*100)+"vw");p.style.setProperty("--drift",((Math.random()-.5)*22)+"vw");p.style.setProperty("--rot",((Math.random()-.5)*720)+"deg");
      p.style.fontSize=(10+Math.random()*18)+"px";p.style.animationDuration=(8+Math.random()*14)+"s";p.style.animationDelay=(-Math.random()*18)+"s";
      layer.appendChild(p);
    }
  }
  function banner(theme){
    let b=document.getElementById("cr-holiday-banner");
    if(!b){b=document.createElement("div");b.id="cr-holiday-banner";document.body.appendChild(b)}
    b.innerHTML='<span class="cr-holiday-icon">'+(ICONS[theme.slug]||"✨")+'</span><span><b>'+theme.name+'</b><br><span style="opacity:.7">CrowSpace animated theme</span></span><button aria-label="Dismiss">×</button>';
    b.querySelector("button").onclick=()=>{b.remove();save("off")};
  }
  function apply(theme){
    document.body.classList.add("cr-holiday-active");
    if(theme.css_class)document.body.classList.add("cr-"+theme.css_class.replace(/_/g,"-"));
    if(theme.accent_color)document.body.style.setProperty("--cr-holiday-accent",theme.accent_color);
    if(theme.secondary_color)document.body.style.setProperty("--cr-holiday-secondary",theme.secondary_color);
    if(theme.background_url)document.body.style.setProperty("--cr-holiday-background","url('"+theme.background_url.replace(/'/g,"%27")+"')");
    const layer=document.createElement("div");layer.id="cr-holiday-layer";document.body.appendChild(layer);
    if(theme.background_url)document.body.style.backgroundImage="linear-gradient(rgba(5,5,11,.82),rgba(5,5,11,.92)),url(\'"+theme.background_url.replace(/\'/g,"%27")+"\')";
    particle(theme);banner(theme);
    document.documentElement.dataset.crowspaceHoliday=theme.slug;
  }
  function settings(list,current){
    const wrap=document.createElement("div");wrap.className="cr-holiday-settings";
    const label=document.createElement("span");label.className="cr-holiday-label";label.textContent=current?"Theme: "+current.name:"Theme: Seasonal";
    const select=document.createElement("select");select.innerHTML='<option value="automatic">Automatic</option><option value="on">On</option><option value="off">Off</option>';select.value=stored();
    select.onchange=async()=>{if(window.CrowSpaceHoliday?.setMode)await window.CrowSpaceHoliday.setMode(select.value);else save(select.value);location.reload()};
    wrap.append(label,select);
    return wrap;
  }
  async function init(){
    injectCss();
    const list=await themes();
    let db=null;
    try{if(window.supabase)db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}catch(e){}
    const mode=db?await getMode(db):stored();
    const current=activeTheme(list);
    if(current&&mode!=="off")apply(current);
    window.CrowSpaceHoliday={themes:list,current,mode,settings:(host)=>{if(host)host.appendChild(settings(list,current))},setMode:async(v)=>{if(db)await persistMode(db,v);else save(v);location.reload()},refresh:()=>location.reload()};
    document.dispatchEvent(new CustomEvent("crowspace:holiday-ready",{detail:{theme:current,mode,list}}));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();