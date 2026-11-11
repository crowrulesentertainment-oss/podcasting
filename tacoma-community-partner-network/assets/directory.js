import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const $=s=>document.querySelector(s),PAGE_SIZE=9;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch{return "";}};
const emailLink=v=>{const s=String(v||"").trim();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?"mailto:"+encodeURIComponent(s):"";};
const phoneLink=v=>{const s=String(v||"").replace(/[^+\d]/g,"");return s.length>=7?"tel:"+s:"";};
const fields=["id","organization_name","short_description","category","logo_url","website_url","is_active","is_featured","city","mission","full_description","cover_image_url","public_email","public_phone","facebook_url","instagram_url","youtube_url","verification_status","recognition_tier"];
let partners=[],filtered=[],page=1;
const search=$("#dirSearch"),category=$("#dirCategory"),city=$("#dirCity"),sort=$("#dirSort"),verified=$("#verifiedOnly");
const menu=$("#mainNav"),toggle=$("#menuToggle");
toggle?.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
menu?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");toggle?.setAttribute("aria-expanded","false");}));
function card(p,featured=false,prefix=""){
 const cover=safeUrl(p.cover_image_url),logo=safeUrl(p.logo_url),website=safeUrl(p.website_url),mail=emailLink(p.public_email),phone=phoneLink(p.public_phone);
 const socials=[["Facebook",p.facebook_url],["Instagram",p.instagram_url],["YouTube",p.youtube_url]].filter(x=>safeUrl(x[1]));
 const id=prefix+"profile-"+String(p.id).replace(/[^a-zA-Z0-9_-]/g,"");
 const desc=p.short_description||"A member of the CrowRules Podcasting Community Partner Network.";
 return '<article class="dir-card">'+
 '<div class="dir-card-cover">'+(cover?'<img src="'+esc(cover)+'" alt="" loading="lazy">':'')+'</div>'+
 '<div class="dir-card-body"><div class="dir-card-brand">'+(logo?'<img class="dir-card-logo" src="'+esc(logo)+'" alt="'+esc(p.organization_name)+' logo" loading="lazy">':'<div class="dir-card-logo dir-card-monogram">'+esc((p.organization_name||"CR").slice(0,2).toUpperCase())+'</div>')+'</div>'+
 '<div class="dir-card-tags"><span class="dir-tag">'+esc(p.category||"COMMUNITY PARTNER")+'</span>'+(p.verification_status==="verified"?'<span class="dir-tag verified">✓ VERIFIED</span>':'')+(p.recognition_tier==="Founding 50"?'<span class="dir-tag founding50-tag">FOUNDING 50</span>':'')+(featured?'<span class="dir-tag">FEATURED</span>':'')+'</div>'+
 '<h3>'+esc(p.organization_name)+'</h3>'+(p.city?'<p class="dir-city">⌖ '+esc(p.city)+'</p>':'')+'<p class="dir-card-desc">'+esc(desc)+'</p>'+
 (p.mission?'<p class="dir-mission"><strong>Mission:</strong> '+esc(p.mission)+'</p>':'')+
 '<div class="dir-card-actions">'+(mail?'<a href="'+esc(mail)+'">Email ↗</a>':'')+(phone?'<a href="'+esc(phone)+'">Call ↗</a>':'')+(website?'<a href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">Website ↗</a>':'')+'</div>'+
 '<button class="dir-profile-toggle" type="button" aria-expanded="false" aria-controls="'+esc(id)+'" data-profile="'+esc(id)+'">View full profile +</button>'+
 '<div class="dir-profile-extra" id="'+esc(id)+'" hidden>'+(p.full_description?'<h4>About</h4><p>'+esc(p.full_description)+'</p>':'')+(p.mission?'<h4>Mission</h4><p>'+esc(p.mission)+'</p>':'')+
 (socials.length?'<h4>Social channels</h4><div class="dir-socials">'+socials.map(x=>'<a href="'+esc(safeUrl(x[1]))+'" target="_blank" rel="noopener noreferrer">'+x[0]+' ↗</a>').join("")+'</div>':'')+
 (!p.full_description&&!p.mission&&!socials.length&&!mail&&!phone&&!website?'<p>More public profile details may be added as this directory grows.</p>':'')+'</div></div></article>';
}
function populateOptions(){
 const cats=[...new Set(partners.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const cities=[...new Set(partners.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 category.innerHTML='<option value="">All categories</option>'+cats.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 city.innerHTML='<option value="">All locations</option>'+cities.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 $("#heroPartnerCount").textContent=String(partners.length);
 $("#heroCategoryCount").textContent=String(cats.length);
}
function applyFilters(){
 const q=search.value.trim().toLowerCase(),cat=category.value,place=city.value,onlyVerified=verified.checked;
 filtered=partners.filter(p=>{
  const hay=[p.organization_name,p.short_description,p.category,p.city,p.mission,p.full_description].join(" ").toLowerCase();
  return (!q||hay.includes(q))&&(!cat||p.category===cat)&&(!place||p.city===place)&&(!onlyVerified||p.verification_status==="verified");
 });
 const mode=sort.value;
 filtered.sort((a,b)=>{
  if(mode==="name")return String(a.organization_name||"").localeCompare(String(b.organization_name||""));
  if(mode==="city")return String(a.city||"").localeCompare(String(b.city||""))||String(a.organization_name||"").localeCompare(String(b.organization_name||""));
  if(mode==="category")return String(a.category||"").localeCompare(String(b.category||""))||String(a.organization_name||"").localeCompare(String(b.organization_name||""));
  return Number(Boolean(b.is_featured))-Number(Boolean(a.is_featured))||String(a.organization_name||"").localeCompare(String(b.organization_name||""));
 });
 page=1;render();
}
function render(){
 const start=(page-1)*PAGE_SIZE,rows=filtered.slice(start,start+PAGE_SIZE);
 $("#dirResultCount").textContent=filtered.length+" matching approved profile"+(filtered.length===1?"":"s")+" · "+partners.length+" total";
 $("#directoryGrid").innerHTML=rows.length?rows.map(p=>card(p)).join(""):'<div class="dir-empty"><h3>No matching partners found.</h3><p>Try changing your search or filters. If you are looking for someone specific, contact CrowRules and tell us what kind of connection you need.</p><button type="button" id="emptyClear" class="dir-clear">Clear filters ↺</button><br><a href="index.html#apply">Apply to join the network ↗</a></div>';
 const featured=partners.filter(p=>p.is_featured);
 $("#featuredSection").hidden=!featured.length;
 $("#featuredCount").textContent=featured.length+" FEATURED";
 $("#featuredGrid").innerHTML=featured.slice(0,6).map(p=>card(p,true,"featured-")).join("");
 const tags=[];
 if(search.value.trim())tags.push("Search: "+search.value.trim());
 if(category.value)tags.push(category.value);
 if(city.value)tags.push(city.value);
 if(verified.checked)tags.push("Verified only");
 $("#activeFilters").innerHTML=tags.map(x=>'<span class="dir-filter-chip">'+esc(x)+'</span>').join("");
 const pages=Math.ceil(filtered.length/PAGE_SIZE),pagination=$("#dirPagination");
 pagination.hidden=pages<=1;
 $("#pageStatus").textContent="Page "+page+" of "+pages;
 $("#prevPage").disabled=page<=1;$("#nextPage").disabled=page>=pages;
 $("#emptyClear")?.addEventListener("click",clearFilters);
}
function clearFilters(){search.value="";category.value="";city.value="";sort.value="featured";verified.checked=false;applyFilters();}
[search,category,city,sort,verified].forEach(el=>el.addEventListener(el===search?"input":"change",applyFilters));
$("#clearFilters").addEventListener("click",clearFilters);
$("#prevPage").addEventListener("click",()=>{if(page>1){page--;render();$("#directoryGrid").scrollIntoView({behavior:"smooth",block:"start"});}});
$("#nextPage").addEventListener("click",()=>{if(page<Math.ceil(filtered.length/PAGE_SIZE)){page++;render();$("#directoryGrid").scrollIntoView({behavior:"smooth",block:"start"});}});
function bindProfileToggles(container){container.addEventListener("click",event=>{const button=event.target.closest("[data-profile]");if(!button)return;const panel=document.getElementById(button.dataset.profile);if(!panel)return;const open=button.getAttribute("aria-expanded")==="true";button.setAttribute("aria-expanded",String(!open));button.textContent=open?"View full profile +":"Hide full profile −";panel.hidden=open;});}\nbindProfileToggles($("#directoryGrid"));bindProfileToggles($("#featuredGrid"));
document.addEventListener("keydown",event=>{if(event.key==="/"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)&&!event.ctrlKey&&!event.metaKey){event.preventDefault();search.focus();}});
async function load(){
 try{
  const {data,error}=await sb.from("podcast_public_partners").select(fields.join(",")).eq("is_active",true).order("is_featured",{ascending:false}).order("organization_name");
  if(error)throw error;
  partners=data||[];populateOptions();applyFilters();
  if(!partners.length){$("#directoryGrid").innerHTML='<div class="dir-empty"><h3>The directory is just getting started.</h3><p>Approved partner profiles will appear here as applications are reviewed.</p><a href="index.html#apply">Introduce yourself ↗</a></div>';$("#dirResultCount").textContent="No approved profiles are published yet.";}
 }catch(error){console.error("Partner directory:",error);$("#dirResultCount").textContent="The partner directory is temporarily unavailable.";$("#directoryGrid").innerHTML='<div class="dir-empty"><h3>We could not load the directory.</h3><p>Please try again in a little while. You can still introduce yourself to the network.</p><a href="index.html#apply">Apply to join ↗</a></div>';$("#heroPartnerCount").textContent="—";$("#heroCategoryCount").textContent="—";}
}
load();