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
  let sb = null, settings = null, schedule = [], previewId = "original", lastImageAuditRows = [];
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
    .crta-image-previews{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(120px,.7fr);gap:12px;margin-top:12px}
    .crta-image-preview{min-width:0;padding:9px;border:1px solid #ffffff18;border-radius:11px;background:#05080d}
    .crta-image-preview b{display:block;margin-bottom:7px;font-size:10px;color:#d5dbe5}
    .crta-image-preview img{display:block;width:100%;height:145px;object-fit:cover;border-radius:7px;background:#171e29}
    .crta-image-preview.mobile img{height:190px;max-width:130px;margin:auto}
    .crta-image-url{width:100%;min-height:38px;padding:8px 10px;border:1px solid #ffffff25;border-radius:9px;background:#080c12;color:#fff;font:inherit;font-size:11px}
    .crta-image-status{display:block;min-height:18px;margin-top:9px;color:#b9c7d5;font-size:11px}
    .crta-image-audit{margin-top:10px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff06;font-size:11px;line-height:1.5}.crta-image-audit ul{margin:7px 0 0;padding-left:18px}.crta-image-audit li{margin:4px 0;color:#f0c1bd}.crta-image-audit .ok{color:#a8dfbd}
    @media(max-width:680px){#crThemeAdmin{top:8px;right:8px}#crThemeAdminToggle{min-height:36px;padding:8px 10px;font-size:11px}#crThemeAdminPanel{right:-2px;padding:13px}.crta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.crta-controls{grid-template-columns:1fr 1fr}.crta-card img{height:90px}.crta-head h2{font-size:18px}.crta-image-previews{grid-template-columns:1fr 110px}.crta-image-preview img{height:115px}.crta-image-preview.mobile img{height:155px;max-width:100px}}
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
        </div><div class="crta-actions"><button class="crta-btn" id="crtaAddSchedule" type="button">Add scheduled window</button><button class="crta-btn" id="crtaExportSchedule" type="button">Export calendar (.ics)</button></div><div class="crta-controls" style="margin-top:10px"><div class="crta-field"><label for="crtaCalendarReminderTiming">CALENDAR REMINDER LEAD TIME</label><select id="crtaCalendarReminderTiming"><option value="-PT15M">15 minutes before</option><option value="-PT1H">1 hour before</option><option value="-P1D" selected>1 day before</option><option value="-P7D">1 week before</option></select></div></div><label class="crta-note" style="display:flex;align-items:center;gap:8px;margin-top:9px"><input id="crtaCalendarReminders" type="checkbox" checked> Include a reminder for each scheduled theme window</label><div class="crta-image-audit" id="crtaScheduleStatus" role="status" aria-live="polite">Schedule preview will appear after settings load.</div><div class="crta-schedule-list" id="crtaScheduleList"></div></div>
        <div class="crta-block" id="crtaImageManager">
          <h3>Theme image manager</h3>
          <p>Upload replacement photography or assign a hosted image URL. Images are stored in the dedicated CrowRules theme bucket; only active platform administrators can upload or remove files.</p>
          <div class="crta-controls">
            <div class="crta-field"><label for="crtaImageTheme">THEME</label><select id="crtaImageTheme"></select></div>
            <div class="crta-field"><label for="crtaImageRole">IMAGE SLOT</label><select id="crtaImageRole"><option value="hero">Hero background</option><option value="gallery">Gallery thumbnail</option><option value="mobile">Mobile background</option><option value="day">Daytime scene</option><option value="evening">Evening scene</option><option value="night">Night scene</option></select></div>
            <div class="crta-field"><label for="crtaImageFile">UPLOAD IMAGE</label><input id="crtaImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div>
          </div>
          <div class="crta-field" style="margin-top:10px"><label for="crtaImageUrl">OR IMAGE URL (HTTPS)</label><input class="crta-image-url" id="crtaImageUrl" type="url" placeholder="https://…"></div>
          <div class="crta-image-previews">
            <div class="crta-image-preview"><b>DESKTOP PREVIEW · WIDE CROP</b><img id="crtaDesktopImagePreview" alt="Desktop theme image preview"></div>
            <div class="crta-image-preview mobile"><b>MOBILE PREVIEW</b><img id="crtaMobileImagePreview" alt="Mobile theme image preview"></div>
          </div>
          <div class="crta-actions"><button class="crta-btn primary" id="crtaUploadImage" type="button">Upload & assign image</button><button class="crta-btn" id="crtaSaveImageUrl" type="button">Save image URL</button><button class="crta-btn" id="crtaCheckDuplicates" type="button">Check duplicates</button><button class="crta-btn" id="crtaAuditImages" type="button">Audit image links</button><button class="crta-btn" id="crtaExportImageAudit" type="button" disabled>Export audit CSV</button></div>
          <small class="crta-image-status" id="crtaImageStatus" role="status" aria-live="polite">Select a theme to manage its photography.</small><div class="crta-image-audit" id="crtaImageAudit" role="status" aria-live="polite">Run an audit to verify assigned image links and identify missing primary image slots.</div>
          <p class="crta-note">Accepted: JPEG, PNG, WebP or AVIF · Maximum 15 MB per image. Hero, gallery and mobile images can be managed independently.</p>
        </div>
        <div class="crta-block" id="crtaCreateEnvironment"><h3>Add a cinematic environment</h3><p>Create new themes and collections from Design Control. New entries are saved to the existing theme settings record and appear in the member gallery after refresh.</p><div class="crta-controls"><div class="crta-field"><label for="crtaNewId">THEME ID</label><input id="crtaNewId" maxlength="48" placeholder="coastal-evening"></div><div class="crta-field"><label for="crtaNewLabel">DISPLAY NAME</label><input id="crtaNewLabel" maxlength="64" placeholder="Coastal Evening"></div><div class="crta-field"><label for="crtaNewCollection">COLLECTION</label><select id="crtaNewCollection"></select></div></div><div class="crta-controls" style="margin-top:10px"><div class="crta-field"><label for="crtaNewCollectionId">NEW COLLECTION ID (OPTIONAL)</label><input id="crtaNewCollectionId" maxlength="40" placeholder="coastal-worlds"></div><div class="crta-field"><label for="crtaNewCollectionLabel">NEW COLLECTION NAME</label><input id="crtaNewCollectionLabel" maxlength="60" placeholder="Coastal Worlds"></div><div class="crta-field"><label for="crtaNewImage">PRIMARY IMAGE URL (HTTPS)</label><input id="crtaNewImage" type="url" placeholder="https://…"></div></div><div class="crta-field" style="margin-top:10px"><label for="crtaNewDescription">DESCRIPTION</label><input id="crtaNewDescription" maxlength="180" placeholder="Describe this cinematic environment"></div><div class="crta-controls" style="margin-top:10px"><div class="crta-field"><label for="crtaNewDay">DAY VARIANT URL (OPTIONAL)</label><input id="crtaNewDay" type="url" placeholder="https://…"></div><div class="crta-field"><label for="crtaNewEvening">EVENING VARIANT URL (OPTIONAL)</label><input id="crtaNewEvening" type="url" placeholder="https://…"></div><div class="crta-field"><label for="crtaNewNight">NIGHT VARIANT URL (OPTIONAL)</label><input id="crtaNewNight" type="url" placeholder="https://…"></div></div><div class="crta-actions"><button class="crta-btn primary" id="crtaCreateTheme" type="button">Create environment</button></div><small class="crta-status" id="crtaCreateStatus" role="status" aria-live="polite">Use a unique theme ID and a secure image URL.</small></div>
        <div class="crta-gallery-head"><div><h3 style="margin:0;font-size:13px">Theme library · <span id="crtaCount"></span></h3><p>Photorealistic, cinematic real-life environments · <span id="crtaImageIntegrity" aria-live="polite"></span></p></div><input id="crtaSearch" type="search" placeholder="Search themes…" aria-label="Search themes"></div>
        <div class="crta-field"><label for="crtaCollection">COLLECTION</label><select id="crtaCollection"><option value="all">All collections</option>${CATALOG.collections.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join("")}</select></div>
        <div class="crta-grid" id="crtaGrid"></div>
        <div class="crta-actions"><button class="crta-btn" id="crtaPreview" type="button">Preview selected in admin</button><button class="crta-btn" id="crtaOriginal" type="button">Preview CrowRules Original</button></div>
      </section>`;
    document.body.appendChild(host);
    const $ = id => document.getElementById(id);
    $("crtaImageTheme").innerHTML = THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+" "+t.label)+'</option>').join("");
    $("crtaFeatured").innerHTML = THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+' '+t.label)+'</option>').join("");
    $("crtaScheduleTheme").innerHTML = THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+' '+t.label)+'</option>').join("");
    const panel=$("crThemeAdminPanel"),toggle=$("crThemeAdminToggle");
    const close=()=>{panel.hidden=true;toggle.setAttribute("aria-expanded","false")};
    toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden))});
    $("crtaClose").addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){close();toggle.focus()}});
    const localDateKey=()=>{const now=new Date();return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0")};
    const scheduleOverlap=(start,end,ignoreIndex=-1)=>schedule.some((item,index)=>index!==ignoreIndex&&item&&item.start&&item.end&&start<=item.end&&end>=item.start);
    const renderSchedule=()=>{
      const today=localDateKey();
      const validWindows=schedule.map((item,index)=>({...item,index})).filter(item=>item&&item.start&&item.end&&item.end>=item.start&&THEMES.some(theme=>theme.id===item.theme_id)).sort((a,b)=>a.start.localeCompare(b.start));
      const active=validWindows.find(item=>item.start<=today&&item.end>=today);
      const next=validWindows.find(item=>item.start>today);
      const conflicts=validWindows.filter((item,index)=>validWindows.slice(index+1).some(other=>item.start<=other.end&&item.end>=other.start));
      const status=$("crtaScheduleStatus");
      if(status)status.innerHTML=active
        ?'<strong>Scheduled now:</strong> '+esc(byId(active.theme_id).label)+' · through '+esc(active.end)+(conflicts.length?' · Overlapping windows need attention.':'')
        :next?'<strong>Next scheduled:</strong> '+esc(byId(next.theme_id).label)+' · '+esc(next.start)+' to '+esc(next.end)+(conflicts.length?' · Overlapping windows need attention.':'')
        :'No active or upcoming custom window.'+(conflicts.length?' · Overlapping windows need attention.':'');
      $("crtaScheduleList").innerHTML=schedule.length?schedule.map((item,i)=>{
        const valid=item&&item.start&&item.end&&item.end>=item.start&&THEMES.some(theme=>theme.id===item.theme_id);
        const state=!valid?"Invalid":item.start<=today&&item.end>=today?"Active":item.end<today?"Past":"Upcoming";
        const overlap=valid&&scheduleOverlap(item.start,item.end,i);
        return '<div class="crta-schedule-item"><span><strong>'+esc(state)+(overlap?' · OVERLAP':'')+'</strong> · '+esc(byId(item.theme_id).label)+' · '+esc(item.start)+' → '+esc(item.end)+'</span><span style="display:flex;gap:6px;flex-shrink:0">'+(valid?'<button type="button" class="crta-btn" data-copy-schedule="'+i+'">Copy to next year</button>':'')+'<button type="button" class="crta-btn" data-remove-schedule="'+i+'">Remove</button></span></div>';
      }).join(""):'<p class="crta-note">No custom event windows scheduled. Automatic seasonal featuring remains available.</p>';
    };
    const renderGrid=()=>{
      const q=$("crtaSearch").value.trim().toLowerCase(),collection=$("crtaCollection").value;
      const list=THEMES.filter(t=>(collection==="all"||t.collection===collection)&&(!q||(t.label+" "+t.desc).toLowerCase().includes(q)));
      $("crtaCount").textContent=list.length+" themes";
      const uniqueImageCount=new Set(THEMES.map(theme=>theme.photo).filter(Boolean)).size;
      const integrity=$("crtaImageIntegrity");if(integrity)integrity.textContent=uniqueImageCount+" unique images across "+THEMES.length+" themes";
      $("crtaGrid").innerHTML=list.map(t=>'<button type="button" class="crta-card" data-theme="'+esc(t.id)+'" aria-pressed="'+(previewId===t.id)+'"><img loading="lazy" src="'+esc(t.photo||"")+'" alt="'+esc(t.imageAlt||t.label)+'"><span class="crta-card-copy"><b>'+esc(t.icon+" "+t.label)+'</b><small>'+esc(t.desc)+'</small><em>'+esc(t.collection||"collection")+'</em></span></button>').join("");
    };
    $("crtaGrid").addEventListener("click",e=>{const card=e.target.closest("[data-theme]");if(!card)return;previewId=card.dataset.theme;$("crtaImageTheme").value=previewId;renderGrid();renderImageManager()});
    $("crtaCollection").addEventListener("change",renderGrid);$("crtaSearch").addEventListener("input",renderGrid);
    const IMAGE_BUCKET="crp-theme-environments";
    function catalogOverrideState(){
      const raw=settings?.theme_catalog;
      const state=raw&&typeof raw==="object"&&!Array.isArray(raw)?JSON.parse(JSON.stringify(raw)):{version:2,themes:{},collections:[],customThemes:[]};
      if(!state.themes||typeof state.themes!=="object"||Array.isArray(state.themes))state.themes={};
      if(!Array.isArray(state.collections))state.collections=[];
      if(!Array.isArray(state.customThemes))state.customThemes=[];
      return state;
    }
    function syncThemeOptions(){
      const options=THEMES.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.icon+' '+t.label)+'</option>').join("");
      ["crtaImageTheme","crtaFeatured","crtaScheduleTheme"].forEach(id=>{const el=$(id),value=el.value;el.innerHTML=options;if(THEMES.some(t=>t.id===value))el.value=value});
      const collectionOptions=CATALOG.collections.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join("");
      $("crtaNewCollection").innerHTML=collectionOptions;
      $("crtaCollection").innerHTML='<option value="all">All collections</option>'+collectionOptions;
    }
    function applyImageOverrides(raw){
      const data=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
      (Array.isArray(data.collections)?data.collections:[]).forEach(collection=>{if(collection&&/^[a-z0-9][a-z0-9-]{1,39}$/.test(collection.id||"")&&collection.label&&!CATALOG.collections.some(c=>c.id===collection.id))CATALOG.collections.push({id:collection.id,label:String(collection.label).slice(0,60)})});
      (Array.isArray(data.customThemes)?data.customThemes:[]).forEach(theme=>{if(!theme||!/^([a-z0-9][a-z0-9-]{1,47})$/.test(theme.id||"")||THEMES.some(t=>t.id===theme.id)||!theme.label||!theme.photo)return;THEMES.push(theme)});
      const map=data.themes||data;
      THEMES.forEach(theme=>{
        const entry=map[theme.id];if(!entry||typeof entry!=="object")return;
        ["photo","hero","mobileHero","imageAlt"].forEach(key=>{if(typeof entry[key]==="string"&&entry[key])theme[key]=entry[key]});if(entry.heroCustom===true)theme.heroCustom=true;if(entry.timeOfDay&&typeof entry.timeOfDay==="object")theme.timeOfDay={...(theme.timeOfDay||{}),...entry.timeOfDay};
      });
    }
    function renderImageManager(){
      const theme=byId($("crtaImageTheme").value||previewId),role=$("crtaImageRole").value;
      const timed=theme.timeOfDay&&theme.timeOfDay[role]||"";
      const desktop=timed||theme.hero||theme.photo||"",mobile=theme.mobileHero||timed||theme.hero||theme.photo||"";
      $("crtaDesktopImagePreview").src=desktop;$("crtaMobileImagePreview").src=mobile;
      $("crtaImageUrl").value=role==="hero"?(theme.hero||""):role==="gallery"?(theme.photo||""):role==="mobile"?(theme.mobileHero||""):timed;
      $("crtaImageStatus").textContent=theme.label+" · "+({day:"daytime",evening:"evening",night:"nighttime"}[role]||role)+" image selected.";
    }
    async function persistThemeImage(themeId,role,url){
      const identity=imageIdentity(url),duplicates=[];
      THEMES.forEach(other=>{if(other.id===themeId)return;["photo","hero","mobileHero"].forEach(key=>{if(other[key]&&imageIdentity(other[key])===identity)duplicates.push(other.label)});Object.entries(other.timeOfDay||{}).forEach(([period,value])=>{if(value&&imageIdentity(value)===identity)duplicates.push(other.label+" ("+period+")")})});
      if(duplicates.length)throw new Error("This image is already assigned to: "+[...new Set(duplicates)].join(", ")+". Choose a different photograph.");
      const next=catalogOverrideState(),existing=next.themes[themeId]||{};
      const patch=role==="hero"?{hero:url,heroCustom:true}:role==="gallery"?{photo:url}:role==="mobile"?{mobileHero:url}:{timeOfDay:{...(existing.timeOfDay||{}),[role]:url}};
      next.version=2;next.themes[themeId]={...existing,...patch};
      $("crtaImageStatus").textContent="Saving image assignment…";
      const {error}=await sb.from("crp_site_settings").update({theme_catalog:next,updated_at:new Date().toISOString()}).eq("site_key","podcasting");
      if(error)throw error;
      settings={...settings,theme_catalog:next};applyImageOverrides(next);renderGrid();renderImageManager();
      $("crtaImageStatus").textContent=themeId+" "+role+" image saved to platform theme settings.";
    }
    function imageIdentity(value){
      try{const u=new URL(value);return u.origin+u.pathname}catch{return String(value||"").trim()}
    }
    function checkImageDuplicates(){
      const theme=byId($("crtaImageTheme").value||previewId),role=$("crtaImageRole").value,url=$("crtaImageUrl").value.trim()||(role==="hero"?theme.hero:role==="gallery"?theme.photo:role==="mobile"?theme.mobileHero:theme.timeOfDay?.[role]);
      if(!url){$("crtaImageStatus").textContent="No image URL is assigned to this slot yet.";return}
      const identity=imageIdentity(url),matches=[];
      THEMES.forEach(other=>{if(other.id===theme.id)return;["hero","photo","mobileHero"].forEach(key=>{if(other[key]&&imageIdentity(other[key])===identity)matches.push(other.label+" ("+key+")")});Object.entries(other.timeOfDay||{}).forEach(([period,value])=>{if(value&&imageIdentity(value)===identity)matches.push(other.label+" ("+period+")")})});
      $("crtaImageStatus").textContent=matches.length?"Duplicate image source found: "+matches.join(", "):"No duplicate image source found in the other "+(THEMES.length-1)+" themes.";
    }
    $("crtaCreateTheme").addEventListener("click",async()=>{
      const status=$("crtaCreateStatus"),button=$("crtaCreateTheme");
      const id=$("crtaNewId").value.trim().toLowerCase(),label=$("crtaNewLabel").value.trim(),image=$("crtaNewImage").value.trim(),desc=$("crtaNewDescription").value.trim();
      const newCollectionId=$("crtaNewCollectionId").value.trim().toLowerCase(),newCollectionLabel=$("crtaNewCollectionLabel").value.trim();
      const collection=newCollectionId||$("crtaNewCollection").value;
      const urls={day:$("crtaNewDay").value.trim(),evening:$("crtaNewEvening").value.trim(),night:$("crtaNewNight").value.trim()};
      try{
        if(!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id))throw new Error("Theme ID must be 2–48 lowercase letters, numbers or hyphens.");
        if(THEMES.some(t=>t.id===id))throw new Error("That theme ID already exists.");
        if(!label||!image||!desc)throw new Error("Enter a name, primary image URL and description.");
        const secure=url=>{if(!url)return true;const parsed=new URL(url);return parsed.protocol==="https:"};
        if(!secure(image)||!Object.values(urls).every(secure))throw new Error("All image URLs must use HTTPS.");
        if(newCollectionId&&(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(newCollectionId)||!newCollectionLabel))throw new Error("Enter a valid new collection ID and collection name.");
        if(newCollectionId&&CATALOG.collections.some(c=>c.id===newCollectionId))throw new Error("That collection ID already exists.");
        if(!newCollectionId&&!CATALOG.collections.some(c=>c.id===collection))throw new Error("Choose an existing collection or define a new one.");
        button.disabled=true;status.textContent="Saving new cinematic environment…";
        const next=catalogOverrideState();
        if(newCollectionId)next.collections.push({id:newCollectionId,label:newCollectionLabel});
        const theme={id,label,icon:"✦",desc,accent:"#d8ad61",glow:"rgba(216,173,97,.22)",panel:"rgba(10,13,19,.94)",ink:"#fff",muted:"#c5c8d0",photo:image,hero:image,collection,imageAlt:label+" cinematic environment"};
        if(Object.values(urls).some(Boolean))theme.timeOfDay=Object.fromEntries(Object.entries(urls).filter(([,url])=>url));
        next.customThemes=next.customThemes.filter(t=>t.id!==id);next.customThemes.push(theme);next.version=2;
        const {error}=await sb.from("crp_site_settings").update({theme_catalog:next,updated_at:new Date().toISOString()}).eq("site_key","podcasting");if(error)throw error;
        settings={...settings,theme_catalog:next};applyImageOverrides(next);syncThemeOptions();renderGrid();renderImageManager();
        status.textContent="Created "+label+". Refresh the public site to load the new environment in member galleries.";
        ["crtaNewId","crtaNewLabel","crtaNewImage","crtaNewDescription","crtaNewCollectionId","crtaNewCollectionLabel","crtaNewDay","crtaNewEvening","crtaNewNight"].forEach(id=>$(id).value="");
      }catch(error){status.textContent="Could not create environment: "+error.message}
      finally{button.disabled=false}
    });
    $("crtaImageTheme").addEventListener("change",renderImageManager);
    $("crtaImageRole").addEventListener("change",renderImageManager);
    $("crtaImageUrl").addEventListener("input",()=>{const url=$("crtaImageUrl").value.trim();if(url){$("crtaDesktopImagePreview").src=url;$("crtaMobileImagePreview").src=url}});
    $("crtaCheckDuplicates").addEventListener("click",checkImageDuplicates);
    async function auditThemeImages(){
      const button=$("crtaAuditImages"),report=$("crtaImageAudit"),exportButton=$("crtaExportImageAudit");
      const slots=[],missing=[];
      THEMES.forEach(theme=>{
        [["hero","hero"],["gallery","photo"],["mobile","mobileHero"]].forEach(([label,key])=>{
          if(theme[key])slots.push({theme:theme.label,themeId:theme.id,slot:label,url:theme[key]});
          else if(key==="hero"||key==="photo")missing.push({theme:theme.label,themeId:theme.id,slot:label,url:"",ok:false,reason:"Missing primary image"});
        });
        Object.entries(theme.timeOfDay||{}).forEach(([period,url])=>{if(url)slots.push({theme:theme.label,themeId:theme.id,slot:period,url})});
      });
      if(!slots.length&&!missing.length){report.textContent="No theme image slots were found.";return}
      button.disabled=true;exportButton.disabled=true;report.textContent="Checking "+slots.length+" assigned image links and "+missing.length+" missing primary slots…";
      let cursor=0,finished=0;const results=[];
      const check=entry=>new Promise(resolve=>{
        let done=false;const img=new Image();const timer=setTimeout(()=>finish(false,"Timed out"),12000);
        const finish=(ok,reason)=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve({...entry,ok,reason:reason||""})};
        try{const parsed=new URL(entry.url);if(parsed.protocol!=="https:"){finish(false,"Not HTTPS");return}}catch{finish(false,"Invalid URL");return}
        img.onload=()=>finish(true,"");img.onerror=()=>finish(false,"Image could not be loaded");img.src=entry.url;
      });
      const worker=async()=>{while(cursor<slots.length){const index=cursor++;results[index]=await check(slots[index]);finished++;if(finished%10===0||finished===slots.length)report.textContent="Checking image links… "+finished+" of "+slots.length;}};
      try{
        await Promise.all(Array.from({length:Math.min(6,slots.length)},worker));
        const rows=[...results,...missing];lastImageAuditRows=rows;
        const failed=results.filter(item=>!item.ok),passed=results.length-failed.length;
        const summary='<strong>'+passed+' of '+results.length+' assigned image links loaded.</strong> '+failed.length+' assigned links failed; '+missing.length+' primary image slots are missing.';
        const issues=rows.filter(item=>!item.ok);
        const details=issues.length?'<ul>'+issues.map(item=>'<li><strong>'+esc(item.theme)+'</strong> · '+esc(item.slot)+': '+esc(item.reason)+'<br><span>'+esc(item.url||"No image assigned")+'</span></li>').join("")+'</ul>':'<p class="ok">All assigned image links loaded and every theme has its primary hero and gallery images.</p>';
        report.innerHTML=summary+details;exportButton.disabled=false;
        $("crtaImageStatus").textContent="Image audit complete: "+passed+" links passed, "+failed.length+" failed, "+missing.length+" primary slots missing.";
      }catch(error){report.textContent="Image audit could not finish: "+error.message}
      finally{button.disabled=false}
    }
    $("crtaAuditImages").addEventListener("click",auditThemeImages);
    $("crtaExportImageAudit").addEventListener("click",()=>{
      if(!lastImageAuditRows.length)return;
      const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
      const csv=[["Theme","Theme ID","Image slot","Status","Details","Image URL"],...lastImageAuditRows.map(row=>[row.theme,row.themeId,row.slot,row.ok?"Loaded":"Needs attention",row.reason,row.url])].map(row=>row.map(quote).join(",")).join("\r\n");
      const blob=new Blob(["\\uFEFF",csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="crowrules-theme-image-audit.csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    });

    $("crtaSaveImageUrl").addEventListener("click",async()=>{
      const theme=byId($("crtaImageTheme").value||previewId),role=$("crtaImageRole").value,url=$("crtaImageUrl").value.trim();
      try{const parsed=new URL(url);if(parsed.protocol!=="https:")throw new Error("Use a secure HTTPS image URL.");if(url.length>2048)throw new Error("Image URL is too long.");await persistThemeImage(theme.id,role,url)}
      catch(error){$("crtaImageStatus").textContent="Could not save image URL: "+error.message}
    });
    $("crtaUploadImage").addEventListener("click",async()=>{
      const theme=byId($("crtaImageTheme").value||previewId),role=$("crtaImageRole").value,file=$("crtaImageFile").files?.[0],button=$("crtaUploadImage");
      if(!file){$("crtaImageStatus").textContent="Choose an image file first.";return}
      if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){$("crtaImageStatus").textContent="Choose a JPEG, PNG, WebP or AVIF image.";return}
      if(file.size>15*1024*1024){$("crtaImageStatus").textContent="Image exceeds the 15 MB upload limit.";return}
      if(!sb){$("crtaImageStatus").textContent="Supabase is not connected.";return}
      button.disabled=true;$("crtaImageStatus").textContent="Uploading image…";
      try{
        const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"})[file.type];
        const token=window.crypto?.randomUUID?.()||String(Date.now())+"-"+Math.random().toString(36).slice(2);
        const path="themes/"+theme.id+"/"+role+"-"+token+"."+ext;
        const {error}=await sb.storage.from(IMAGE_BUCKET).upload(path,file,{cacheControl:"31536000",upsert:false,contentType:file.type});
        if(error)throw error;
        const {data}=sb.storage.from(IMAGE_BUCKET).getPublicUrl(path);
        if(!data?.publicUrl)throw new Error("Storage did not return a public image URL.");
        await persistThemeImage(theme.id,role,data.publicUrl);
        $("crtaImageFile").value="";
      }catch(error){$("crtaImageStatus").textContent="Image upload failed: "+error.message}
      finally{button.disabled=false}
    });

    $("crtaScheduleList").addEventListener("click",e=>{const copy=e.target.closest("[data-copy-schedule]");if(copy){const index=Number(copy.dataset.copySchedule),item=schedule[index];if(!item)return;const shiftYear=value=>{const [year,month,day]=value.split("-").map(Number),targetYear=year+1,lastDay=new Date(targetYear,month,0).getDate();return targetYear+"-"+String(month).padStart(2,"0")+"-"+String(Math.min(day,lastDay)).padStart(2,"0")};const start=shiftYear(item.start),end=shiftYear(item.end);if(scheduleOverlap(start,end)){$("crtaStatus").textContent="Cannot copy: next year's dates overlap another scheduled window.";return}schedule.push({theme_id:item.theme_id,start,end});schedule.sort((a,b)=>a.start.localeCompare(b.start));renderSchedule();$("crtaStatus").textContent="Copied "+byId(item.theme_id).label+" to "+start+"–"+end+". Publish platform settings to save it.";return}const remove=e.target.closest("[data-remove-schedule]");if(!remove)return;schedule.splice(Number(remove.dataset.removeSchedule),1);renderSchedule()});
    $("crtaExportSchedule").addEventListener("click",()=>{
      const valid=schedule.filter(item=>item&&item.start&&item.end&&item.end>=item.start&&THEMES.some(theme=>theme.id===item.theme_id));
      if(!valid.length){$("crtaStatus").textContent="There are no valid scheduled windows to export.";return}
      const escapeICS=value=>String(value).replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
      const dateKey=value=>value.replace(/-/g,"");
      const plusOne=value=>{const [y,m,d]=value.split("-").map(Number),next=new Date(Date.UTC(y,m-1,d+1));return next.toISOString().slice(0,10).replace(/-/g,"")};
      const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
      const includeReminders=$("crtaCalendarReminders").checked;
      const events=valid.map((item,index)=>{const theme=byId(item.theme_id),lines=["BEGIN:VEVENT","UID:"+escapeICS(item.theme_id+"-"+item.start+"-"+index+"@crowrules-podcasting"),"DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+dateKey(item.start),"DTEND;VALUE=DATE:"+plusOne(item.end),"SUMMARY:"+escapeICS("CrowRules Podcasting — "+theme.label),"DESCRIPTION:"+escapeICS("Scheduled cinematic environment: "+theme.label)];if(includeReminders)lines.push("BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+escapeICS("Reminder: "+theme.label+" begins on CrowRules Podcasting"),"TRIGGER:"+($("crtaCalendarReminderTiming").value||"-P1D"),"END:VALARM");lines.push("END:VEVENT");return lines.join("\r\n")});
      const calendar=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CrowRules Entertainment//Podcasting Theme Schedule//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",...events,"END:VCALENDAR"].join("\r\n")+"\r\n";
      const url=URL.createObjectURL(new Blob([calendar],{type:"text/calendar;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="crowrules-cinematic-theme-schedule.ics";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
      $("crtaStatus").textContent="Exported "+valid.length+" scheduled theme window"+(valid.length===1?"":"s")+". Import the .ics file into your calendar app.";
    });
    $("crtaAddSchedule").addEventListener("click",()=>{
      const theme_id=$("crtaScheduleTheme").value,start=$("crtaStart").value,end=$("crtaEnd").value;
      if(!THEMES.some(theme=>theme.id===theme_id)||!start||!end||end<start){$("crtaStatus").textContent="Choose a valid theme, start date and end date.";return}
      if(scheduleOverlap(start,end)){$("crtaStatus").textContent="This date range overlaps an existing scheduled window. Adjust the dates or remove the conflicting window first.";return}
      schedule.push({theme_id,start,end});schedule.sort((a,b)=>a.start.localeCompare(b.start));renderSchedule();$("crtaStatus").textContent="Schedule window added. Publish platform settings to save it.";
    });
    $("crtaPreview").addEventListener("click",()=>{window.dispatchEvent(new CustomEvent("cr:site-theme-change",{detail:previewId}));$("crtaStatus").textContent=byId(previewId).label+" preview is active on this admin screen only."});
    $("crtaOriginal").addEventListener("click",()=>{previewId="original";renderGrid();window.dispatchEvent(new CustomEvent("cr:site-theme-change",{detail:"original"}))});
    $("crtaRefresh").addEventListener("click",loadSettings);
    $("crtaSave").addEventListener("click",saveSettings);
    renderGrid();renderSchedule();renderImageManager();
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
      settings=data;applyImageOverrides(data.theme_catalog);syncThemeOptions();schedule=Array.isArray(data.theme_schedule)?data.theme_schedule:[];
      $("crtaMode").value=data.theme_mode||"seasonal";$("crtaFeatured").value=byId(data.featured_theme||"original").id;$("crtaAuto").value=String(data.seasonal_auto!==false);
      renderSchedule();renderGrid();renderImageManager();$("crtaStatus").textContent="Connected. "+THEMES.length+" cinematic themes available. Personal member themes remain independent.";
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