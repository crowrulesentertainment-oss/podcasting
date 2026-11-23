/* CrowRules Podcasting cinematic theme administration.
 * Featured theme configuration is platform-wide; preview is local to this admin session.
 */
(() => {
  "use strict";
  if (document.body.dataset.page !== "admin") return;
  const CATALOG = window.CRP_THEME_CATALOG;
  if (!CATALOG?.themes?.length) return;
  const THEMES = CATALOG.themes;
  const byId = id => THEMES.find(t => t.id === id) || THEMES[0];
  let sb = null, settings = null, schedule = [], previewId = "original";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const style = document.createElement("style");
  style.id = "cr-cinematic-theme-admin-css";
  style.textContent = `
    #crThemeAdmin{position:fixed;z-index:10020;top:14px;right:16px;font:inherit;color:#f7f8fb}
    #crThemeAdmin *{box-sizing:border-box}
    #crThemeAdminToggle{display:flex;align-items:center;gap:9px;min-height:42px;padding:10px 14px;border:1px solid #ffffff2b;border-radius:13px;background:#10151e;color:#fff;font-weight:850;font-size:12px;box-shadow:0 10px 30px #0007;cursor:pointer}
    #crThemeAdminToggle:hover{border-color:#d84b55}
    #crThemeAdminPanel{position:absolute;top:50px;right:0;width:min(760px,calc(100vw - 24px));max-height:min(86vh,900px);overflow:auto;padding:18px;border:1px solid #ffffff24;border-radius:20px;background:linear-gradient(145deg,#141a24,#090d14);box-shadow:0 24px 80px #000b}
    #crThemeAdminPanel[hidden]{display:none}
    #crThemeAdminPanel h2{margin:0;font-size:22px;letter-spacing:-.04em}
    #crThemeAdminPanel p{margin:5px 0;color:#aeb8c8;font-size:12px;line-height:1.5}
    .crta-head{display:flex;justify-content:space-between;gap:14px;align-items:start;margin-bottom:16px}
    .crta-kicker{color:#e3b66c;font-size:9px;font-weight:900;letter-spacing:.18em}
    .crta-close{border:1px solid #ffffff20;background:#ffffff0b;color:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}
    .crta-block{padding:14px;margin:14px 0;border:1px solid #ffffff17;border-radius:14px;background:#ffffff06}
    .crta-block h3{margin:0 0 9px;font-size:13px}
    .crta-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .crta-field{display:grid;gap:6px;min-width:0}
    .crta-field label{font-size:10px;font-weight:850;letter-spacing:.06em;color:#bfc7d3}
    .crta-field select,.crta-field input{width:100%;min-height:39px;padding:8px 10px;border:1px solid #ffffff25;border-radius:9px;background:#080c12;color:#fff;font:inherit;font-size:12px}
    .crta-gallery-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:16px 0 10px}
    .crta-gallery-head input{max-width:220px;min-height:36px;padding:7px 10px;border:1px solid #ffffff24;border-radius:9px;background:#080c12;color:white}
    .crta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .crta-card{min-width:0;overflow:hidden;border:1px solid #ffffff1c;border-radius:12px;background:#080c12;color:#fff;text-align:left;padding:0;cursor:pointer}
    .crta-card[aria-pressed=true]{border:2px solid #e3b66c;box-shadow:0 0 0 2px #e3b66c22}
    .crta-card img{display:block;width:100%;height:100px;object-fit:cover;background:#202630}
    .crta-card-copy{padding:9px}
    .crta-card-copy b{display:block;font-size:11px;line-height:1.3}
    .crta-card-copy small{display:block;margin-top:4px;color:#aeb8c8;font-size:9px;line-height:1.4}
    .crta-card-copy em{display:inline-block;margin-top:6px;color:#e3b66c;font-size:8px;font-style:normal;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .crta-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .crta-btn{min-height:38px;padding:8px 13px;border:1px solid #ffffff25;border-radius:9px;background:#ffffff0b;color:#fff;font-weight:800;font-size:11px;cursor:pointer}
    .crta-btn.primary{border-color:#e3b66c;background:linear-gradient(120deg,#a66b37,#e3b66c);color:#17110a}
    .crta-status{display:block;min-height:18px;margin-top:9px;color:#b9c7d5;font-size:11px}
    .crta-schedule-list{display:grid;gap:6px;margin-top:10px}
    .crta-schedule-item{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;background:#ffffff09;font-size:10px;color:#d7deea}
    .crta-note{font-size:10px!important;color:#8f9bac!important}
    @media(max-width:680px){#crThemeAdmin{top:8px;right:8px}#crThemeAdminToggle{min-height:36px;padding:8px 10px;font-size:11px}#crThemeAdminPanel{right:-2px;padding:13px}.crta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.crta-controls{grid-template-columns:1fr 1fr}.crta-card img{height:90px}.crta-head h2{font-size:18px}}
    @media(prefers-reduced-motion:reduce){#crThemeAdminPanel *{scroll-behavior:auto!important;transition:none!important}}
  `;
  document.head.appendChild(style);
  const mount = () => {
    if (document.getElementById("crThemeAdmin")) return;
    const host = document.createElement("div");
    host.id = "crThemeAdmin";
    host.innerHTML = `
      <button id="crThemeAdminToggle" type="button" aria-expanded="false" aria-controls="crThemeAdminPanel">🎬 <span>Cinematic Themes</span></button>
      <section id="crThemeAdminPanel" hidden aria-label="Cinematic theme administration">
        <div class="crta-head"><div><span class="crta-kicker">CROWRULES PODCASTING · DESIGN CONTROL</span><h2>Cinematic World Selector</h2><p>Manage the platform featured environment, seasonal automation, holiday windows and the growing theme library.</p></div><button class="crta-close" id="crtaClose" type="button">Close</button></div>
        <div class="crta-block"><h3>Platform-wide featured theme</h3>
          <div class="crta-controls">
            <div class="crta-field"><label for="crtaMode">FEATURE MODE</label><select id="crtaMode"><option value="seasonal">Automatic seasonal</option><option value="manual">Manual featured theme</option><option value="scheduled">Scheduled event</option></select></div>
            <div class="crta-field"><label for="crtaFeatured">FEATURED THEME</label><select id="crtaFeatured"></select></div>
            <div class="crta-field"><label for="crtaAuto">SEASONAL AUTOMATION</label><select id="crtaAuto"><option value="true">Enabled</option><option value="false">Disabled</option></select></div>
          </div>
          <div class="crta-actions"><button class="crta-btn primary" id="crtaSave" type="button">Publish platform settings</button><button class="crta-btn" id="crtaRefresh" type="button">Reload settings</button></div>
          <small class="crta-status" id="crtaStatus" role="status" aria-live="polite">Connecting to theme settings…</small>
          <p class="crta-note">Publishing changes the featured theme for members who have not saved a personal preference. It never overwrites a member's selected theme.</p>
        </div>
        <div class="crta-block"><h3>Holiday & event scheduler</h3><div class="crta-controls">
          <div class="crta-field"><label for="crtaScheduleTheme">THEME</label><select id="crtaScheduleTheme"></select></div>
          <div class="crta-field"><label for="crtaStart">START DATE</label><input id="crtaStart" type="date"></div>
          <div class="crta-field"><label for="crtaEnd">END DATE</label><input id="crtaEnd" type="date"></div>
        </div><div class="crta-actions"><button class="crta-btn" id="crtaAddSchedule" type="button">Add scheduled window</button></div><div class="crta-schedule-list" id="crtaScheduleList"></div></div>
        <div class="crta-gallery-head"><div><h3 style="margin:0;font-size:13px">Theme library · <span id="crtaCount"></span></h3><p>Photorealistic, cinematic real-life environments · <span id="crtaImageIntegrity" aria-live="polite"></span></p></div><input id="crtaSearch" type="search" placeholder="Search themes…" aria-label="Search themes"></div>
        <div class="crta-field"><label for="crtaCollection">COLLECTION</label><select id="crtaCollection"><option value="all">All collections</option>${CATALOG.collections.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join("")}</select></div>
        <div class="crta-grid" id="crtaGrid"></div>
        <div class="crta-actions"><button class="crta-btn" id="crtaPreview" type="button">Preview selected in admin</button><button class="crta-btn" id="crtaOriginal" type="button">Preview CrowRules Original</button></div>
      </section>`;
    document.body.appendChild(host);
    const $ = id => document.getElementById(id);
    $("crtaFeatured").innerHTML = THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+' '+t.label)+'</option>').join("");
    $("crtaScheduleTheme").innerHTML = THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+' '+t.label)+'</option>').join("");
    const panel=$("crThemeAdminPanel"),toggle=$("crThemeAdminToggle");
    const close=()=>{panel.hidden=true;toggle.setAttribute("aria-expanded","false")};
    toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden))});
    $("crtaClose").addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){close();toggle.focus()}});
    const renderSchedule=()=>{$("crtaScheduleList").innerHTML=schedule.length?schedule.map((item,i)=>'<div class="crta-schedule-item"><span>'+esc(byId(item.theme_id).label)+' · '+esc(item.start)+' → '+esc(item.end)+'</span><button type="button" class="crta-btn" data-remove-schedule="'+i+'">Remove</button></div>').join(""):'<p class="crta-note">No custom event windows scheduled. Automatic seasonal featuring remains available.</p>';};
    const renderGrid=()=>{
      const q=$("crtaSearch").value.trim().toLowerCase(),collection=$("crtaCollection").value;
      const list=THEMES.filter(t=>(collection==="all"||t.collection===collection)&&(!q||(t.label+" "+t.desc).toLowerCase().includes(q)));
      $("crtaCount").textContent=list.length+" themes";
      const uniqueImageCount=new Set(THEMES.map(theme=>theme.photo).filter(Boolean)).size;
      const integrity=$("crtaImageIntegrity");if(integrity)integrity.textContent=uniqueImageCount+" unique images across "+THEMES.length+" themes";
      $("crtaGrid").innerHTML=list.map(t=>'<button type="button" class="crta-card" data-theme="'+esc(t.id)+'" aria-pressed="'+(previewId===t.id)+'"><img loading="lazy" src="'+esc(t.photo||"")+'" alt="'+esc(t.imageAlt||t.label)+'"><span class="crta-card-copy"><b>'+esc(t.icon+" "+t.label)+'</b><small>'+esc(t.desc)+'</small><em>'+esc(t.collection||"collection")+'</em></span></button>').join("");
    };
    $("crtaGrid").addEventListener("click",e=>{const card=e.target.closest("[data-theme]");if(!card)return;previewId=card.dataset.theme;renderGrid()});
    $("crtaCollection").addEventListener("change",renderGrid);$("crtaSearch").addEventListener("input",renderGrid);
    $("crtaScheduleList").addEventListener("click",e=>{const b=e.target.closest("[data-remove-schedule]");if(!b)return;schedule.splice(Number(b.dataset.removeSchedule),1);renderSchedule()});
    $("crtaAddSchedule").addEventListener("click",()=>{const theme_id=$("crtaScheduleTheme").value,start=$("crtaStart").value,end=$("crtaEnd").value;if(!start||!end||end<start){$("crtaStatus").textContent="Choose a valid start and end date.";return}schedule.push({theme_id,start,end});schedule.sort((a,b)=>a.start.localeCompare(b.start));renderSchedule();$("crtaStatus").textContent="Schedule window added. Publish platform settings to save it."});
    $("crtaPreview").addEventListener("click",()=>{window.dispatchEvent(new CustomEvent("cr:site-theme-change",{detail:previewId}));$("crtaStatus").textContent=byId(previewId).label+" preview is active on this admin screen only."});
    $("crtaOriginal").addEventListener("click",()=>{previewId="original";renderGrid();window.dispatchEvent(new CustomEvent("cr:site-theme-change",{detail:"original"}))});
    $("crtaRefresh").addEventListener("click",loadSettings);
    $("crtaSave").addEventListener("click",saveSettings);
    renderGrid();renderSchedule();
    async function connect(){
      try{
        const mod=await import("./client.js");sb=mod.sb;
        const {data:{user},error}=await sb.auth.getUser();if(error)throw error;if(!user)throw new Error("Sign in with an administrator account to manage platform themes.");
        const {data:admin,error:adminError}=await sb.from("cr_admins").select("role,is_active").eq("user_id",user.id).maybeSingle();
        if(adminError)throw adminError;if(!admin||!admin.is_active||!["admin","super_admin"].includes(String(admin.role).toLowerCase()))throw new Error("Your account does not have active platform administrator access.");
        await loadSettings();
      }catch(error){$("crtaStatus").textContent="Theme administration unavailable: "+error.message}
    }
    async function loadSettings(){
      if(!sb)return;
      $("crtaStatus").textContent="Loading platform theme settings…";
      const {data,error}=await sb.from("crp_site_settings").select("featured_theme,theme_mode,seasonal_auto,featured_starts_at,featured_ends_at,theme_schedule,theme_catalog,holiday_theme,holiday_enabled").eq("site_key","podcasting").maybeSingle();
      if(error)throw error;if(!data)throw new Error("The podcasting theme settings row was not found.");
      settings=data;schedule=Array.isArray(data.theme_schedule)?data.theme_schedule:[];
      $("crtaMode").value=data.theme_mode||"seasonal";$("crtaFeatured").value=byId(data.featured_theme||"original").id;$("crtaAuto").value=String(data.seasonal_auto!==false);
      renderSchedule();$("crtaStatus").textContent="Connected. "+THEMES.length+" cinematic themes available. Personal member themes remain independent.";
    }
    async function saveSettings(){
      if(!sb||!settings)return;
      $("crtaSave").disabled=true;$("crtaStatus").textContent="Publishing theme settings…";
      const mode=$("crtaMode").value,featured=$("crtaFeatured").value,auto=$("crtaAuto").value==="true";
      const patch={featured_theme:featured,theme_mode:mode,seasonal_auto:auto,theme_schedule:schedule,holiday_theme:featured,holiday_enabled:mode!=="manual"||featured!=="original",updated_at:new Date().toISOString()};
      const {error}=await sb.from("crp_site_settings").update(patch).eq("site_key","podcasting");
      $("crtaSave").disabled=false;
      if(error){$("crtaStatus").textContent="Could not publish: "+error.message;return}
      settings={...settings,...patch};$("crtaStatus").textContent="Published. Members without a saved personal theme will see the current featured environment.";
      window.dispatchEvent(new CustomEvent("cr:featured-theme-published",{detail:patch}));
    }
    connect();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();