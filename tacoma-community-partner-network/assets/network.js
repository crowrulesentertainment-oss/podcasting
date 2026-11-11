import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const categories=["Business & Brands","Sponsors & Advertisers","Media & Podcast Networks","Creators & Production","Guests & Subject Experts","Nonprofits & Charities","Education & Youth","Community Organizations","Arts, Culture & Entertainment","Sports & Recreation","Professional Services","Other / Not Listed","Food & Beverage","Small Business & Retail","Health & Wellness","Creators & Media","Individuals & Independent Professionals"];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch{return "";}};
$("#year").textContent=new Date().getFullYear();
const menu=$("#mainNav"),toggle=$("#menuToggle");
toggle.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");toggle.setAttribute("aria-expanded","false");}));
const filter=$("#categoryFilter");categories.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;filter.append(o);});
let partners=[];
function partnerCard(p,featured=false){
 const logo=safeUrl(p.logo_url),cover=safeUrl(p.cover_image_url);
 const social=[["Facebook",p.facebook_url],["Instagram",p.instagram_url],["YouTube",p.youtube_url]].filter(x=>safeUrl(x[1]));
 return '<article class="partner-card '+(featured?"featured-card":"")+'">'+
 (cover?'<img class="partner-cover" src="'+esc(cover)+'" alt="" loading="lazy">':'<div class="partner-cover cover-placeholder"></div>')+
 '<div class="partner-card-body">'+(logo?'<img class="partner-logo" src="'+esc(logo)+'" alt="'+esc(p.organization_name)+' logo" loading="lazy">':'<div class="partner-logo monogram">'+esc((p.organization_name||"CR").slice(0,2).toUpperCase())+'</div>')+
 '<div class="partner-card-meta"><span class="partner-category">'+esc(p.category||"COMMUNITY PARTNER")+'</span>'+(p.verification_status==="verified"?'<span class="verified-mark" title="Verified organization">✓ VERIFIED</span>':'')+(featured?'<span class="featured-mark">FEATURED</span>':'')+'</div>'+
 '<h3>'+esc(p.organization_name)+'</h3>'+(p.city?'<p class="partner-location">'+esc(p.city)+'</p>':'')+
 '<p>'+esc(p.short_description||"A member of the CrowRules Tacoma Community Partner Network.")+'</p>'+
 '<details class="partner-details"><summary>View organization profile</summary>'+
 (p.mission?'<h4>Our mission</h4><p>'+esc(p.mission)+'</p>':'')+
 (p.full_description?'<h4>About the organization</h4><p>'+esc(p.full_description)+'</p>':'')+
 '<div class="profile-contact">'+(p.public_email?'<a href="mailto:'+esc(p.public_email)+'">Email organization ↗</a>':'')+(p.public_phone?'<span>'+esc(p.public_phone)+'</span>':'')+(safeUrl(p.website_url)?'<a href="'+esc(safeUrl(p.website_url))+'" target="_blank" rel="noopener noreferrer">Website ↗</a>':'')+social.map(x=>'<a href="'+esc(safeUrl(x[1]))+'" target="_blank" rel="noopener noreferrer">'+x[0]+' ↗</a>').join("")+'</div></details>'+
 (safeUrl(p.website_url)?'<a class="partner-website" href="'+esc(safeUrl(p.website_url))+'" target="_blank" rel="noopener noreferrer">Visit website ↗</a>':'')+'</div></article>';
}
function render(){
 const q=$("#partnerSearch").value.trim().toLowerCase(),cat=filter.value;
 const rows=partners.filter(p=>(!cat||p.category===cat)&&(!q||[p.organization_name,p.short_description,p.category,p.city,p.mission,p.full_description].join(" ").toLowerCase().includes(q)));
 const featured=partners.filter(p=>p.is_featured);
 $("#partnerCount").textContent=partners.length+" APPROVED PARTNER"+(partners.length===1?"":"S");
 const featureWrap=$("#featuredPartners");
 featureWrap.hidden=!featured.length;
 $("#featuredPartnerGrid").innerHTML=featured.map(p=>partnerCard(p,true)).join("");
 $("#partnerDirectory").innerHTML=rows.length?rows.map(p=>partnerCard(p,false)).join(""):'<div class="empty-state"><div class="empty-symbol">✦</div><h3>No matching partners yet.</h3><p>Try another search or category. Our directory will grow as partners are approved.</p></div>';
}
async function loadPartners(){
 const box=$("#partnerDirectory");
 try{
  const {data,error}=await sb.from("podcast_public_partners").select("id,organization_name,short_description,category,logo_url,website_url,is_active,sort_order,is_featured,city,mission,full_description,cover_image_url,public_email,public_phone,facebook_url,instagram_url,youtube_url,verification_status").eq("is_active",true).order("is_featured",{ascending:false}).order("sort_order").order("organization_name");
  if(error)throw error;
  partners=data||[];render();
 }catch(e){console.error("Partner directory:",e);box.innerHTML='<div class="empty-state"><div class="empty-symbol">✦</div><h3>Our community is taking shape.</h3><p>The partner directory is being prepared. You can still submit an application below.</p></div>';}
}
$("#partnerSearch").addEventListener("input",render);filter.addEventListener("change",render);
loadPartners();
const liveVisitorCount=$("#liveVisitorCount");
let visitorId="";
try{visitorId=sessionStorage.getItem("cr_partner_network_visitor")||crypto.randomUUID();sessionStorage.setItem("cr_partner_network_visitor",visitorId);}catch(e){visitorId=crypto.randomUUID();}
const visitorPath=location.pathname.slice(0,300)||"/";
async function recordVisit(eventType){
 try{const {error}=await sb.from("partner_network_analytics").insert({visitor_id:visitorId,page_path:visitorPath,event_type:eventType});if(error)console.warn("Visitor analytics:",error.message);}
 catch(e){console.warn("Visitor analytics unavailable:",e);}
}
async function refreshLiveVisitors(){
 try{const {data,error}=await sb.rpc("partner_network_live_visitors");if(error)throw error;if(liveVisitorCount)liveVisitorCount.textContent=String(data??0);}
 catch(e){if(liveVisitorCount)liveVisitorCount.textContent="—";console.warn("Live visitor count:",e.message);}
}
recordVisit("pageview");refreshLiveVisitors();
setInterval(()=>{if(document.visibilityState==="visible"){recordVisit("heartbeat");refreshLiveVisitors();}},60000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){recordVisit("heartbeat");refreshLiveVisitors();}});
const form=$("#partnerForm"),feedback=$("#formFeedback"),button=form.querySelector('button[type="submit"]');
const logoInput=$("#organizationLogo"),logoPreviewWrap=$("#logoPreviewWrap"),logoPreview=$("#logoPreview"),removeLogo=$("#removeLogo");
let logoPreviewUrl="";
function clearLogo(){logoInput.value="";if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);logoPreviewUrl="";logoPreview.removeAttribute("src");logoPreviewWrap.hidden=true;}
logoInput.addEventListener("change",()=>{
 const file=logoInput.files?.[0];if(!file){clearLogo();return;}
 const allowed=["image/jpeg","image/png","image/webp"];
 if(!allowed.includes(file.type)){clearLogo();feedback.textContent="Please choose a JPG, PNG or WebP image.";feedback.classList.add("error");return;}
 if(file.size>2*1024*1024){clearLogo();feedback.textContent="Logo files must be 2 MB or smaller.";feedback.classList.add("error");return;}
 if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);
 logoPreviewUrl=URL.createObjectURL(file);logoPreview.src=logoPreviewUrl;logoPreviewWrap.hidden=false;
 feedback.textContent="Logo ready to upload.";feedback.className="form-feedback";
});
removeLogo.addEventListener("click",clearLogo);
async function fileToBase64(file){
 const bytes=new Uint8Array(await file.arrayBuffer());let binary="";
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
}
form.addEventListener("submit",async e=>{
 e.preventDefault();feedback.textContent="";feedback.className="form-feedback";
 if(!form.reportValidity())return;
 const f=new FormData(form);
 if(String(f.get("company_website")||"").trim())return;
 button.disabled=true;button.textContent="Submitting application…";
 const type=String(f.get("category")||"");
 const website=String(f.get("website")||"").trim();
 const message="Applicant type: "+String(f.get("applicant_type")||"Not specified")+"\nCategory: "+type+"\nCity/community: "+String(f.get("city")||"").trim()+"\nPhone: "+String(f.get("phone")||"").trim()+"\nWho they serve: "+String(f.get("audience")||"Not specified").trim()+"\nCollaboration interest: "+String(f.get("collaboration")||"Not specified").trim()+"\n\n"+String(f.get("message")||"").trim();
 try{
  const logoFile=logoInput.files?.[0];
  const logoPayload=logoFile?{logo_data:await fileToBase64(logoFile),logo_content_type:logoFile.type}: {};
  const {data,error}=await sb.functions.invoke("partnership-application",{body:{name:String(f.get("name")||"").trim(),organization:String(f.get("organization")||"").trim(),email:String(f.get("email")||"").trim(),interest:"partnership",message:"Partnership pathway: "+String(f.get("collaboration")||"Not specified")+"\n"+message,website_url:website,company_website:String(f.get("company_website")||"").trim(),...logoPayload}});
  if(error){
   let detail="";
   try{const responseBody=await error.context?.json();detail=responseBody?.error||"";}catch(e){}
   throw new Error(detail||error.message||"The application could not be confirmed.");
  }
  if(!data?.ok)throw new Error(data?.error||"The application could not be confirmed.");
  feedback.textContent=data.notification_sent===false?"Your application was saved, but the email notification could not be confirmed. The team can review it in the administration center.":"Thank you. Your application has been received and saved. The CrowRules team will review it.";
  feedback.classList.add("success");form.reset();clearLogo();
 }catch(err){console.error(err);feedback.textContent=err.message||"We couldn't submit your application. Please try again or email crowrulesentertainment@gmail.com.";feedback.classList.add("error");}
 finally{button.disabled=false;button.innerHTML='Submit partner application <span>↗</span>';}
});

// Phase 2 community board: public content is visible only after administrator approval.
const boardTabs=[...document.querySelectorAll("[data-board-tab]")];
boardTabs.forEach(tab=>tab.addEventListener("click",()=>{
 boardTabs.forEach(t=>t.classList.toggle("active",t===tab));
 ["opportunities","announcements","events","submit"].forEach(key=>{const panel=$("#board-"+key);panel.hidden=key!==tab.dataset.boardTab;});
}));
let opportunityRows=[],announcementRows=[],eventRows=[];
let eventMonth=new Date();eventMonth.setDate(1);
const typeLabels={collaboration:"COLLABORATION",volunteer:"VOLUNTEER",resource_offer:"RESOURCE OFFER",resource_request:"RESOURCE REQUEST"};
function opportunityCard(o){
 const link=safeUrl(o.website_url);
 const expiry=o.expires_at?new Date(o.expires_at+"T12:00:00").toLocaleDateString():"";
 return '<article class="board-card"><div class="board-card-meta"><span>'+esc(typeLabels[o.opportunity_type]||"OPPORTUNITY")+'</span><span>'+esc(o.category)+'</span></div><h4>'+esc(o.title)+'</h4><p class="board-org">'+esc(o.organization_name)+' · '+esc(o.city)+'</p><p>'+esc(o.description)+'</p>'+
 (o.what_needed?'<p><strong>Looking for:</strong> '+esc(o.what_needed)+'</p>':'')+(o.what_offered?'<p><strong>Can offer:</strong> '+esc(o.what_offered)+'</p>':'')+
 (expiry?'<small>Listed until '+esc(expiry)+'</small>':'')+(link?'<a class="board-link" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Contact / learn more ↗</a>':'')+'</article>';
}
function renderOpportunities(){
 const selected=$("#opportunityFilter").value;
 const rows=opportunityRows.filter(o=>!selected||o.opportunity_type===selected);
 $("#opportunityList").innerHTML=rows.length?rows.map(opportunityCard).join(""):'<p class="muted">No published opportunities match this filter yet. Check back as the community board grows.</p>';
 const offers=opportunityRows.filter(o=>o.opportunity_type==="resource_offer"||o.opportunity_type==="collaboration");
 const needs=opportunityRows.filter(o=>o.opportunity_type==="resource_request"||o.opportunity_type==="collaboration");
 const pairs=[];
 for(const need of needs)for(const offer of offers){
  if(need.id===offer.id||need.organization_name.toLowerCase()===offer.organization_name.toLowerCase())continue;
  const sameCity=String(need.city||"").toLowerCase()===String(offer.city||"").toLowerCase();
  const sameCategory=String(need.category||"").toLowerCase()===String(offer.category||"").toLowerCase();
  const textOverlap=[need.what_needed,need.description].join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>4&&[offer.what_offered,offer.description].join(" ").toLowerCase().includes(w));
  const score=(sameCity?2:0)+(sameCategory?2:0)+(textOverlap.length?1:0);
  if(score>=2)pairs.push({need,offer,score});
 }
 pairs.sort((a,b)=>b.score-a.score);
 $("#matchmakerResults").innerHTML=pairs.length?'<div class="matchmaker-heading"><span>✦ MATCHMAKER SUGGESTIONS</span><p>Potential connections based on shared categories, communities and descriptions. These are suggestions, not confirmed partnerships.</p></div>'+pairs.slice(0,3).map(x=>'<article class="match-card"><div><small>LOOKING FOR</small><strong>'+esc(x.need.organization_name)+'</strong><span>'+esc(x.need.what_needed||x.need.title)+'</span></div><div class="match-symbol">↔</div><div><small>POTENTIAL MATCH</small><strong>'+esc(x.offer.organization_name)+'</strong><span>'+esc(x.offer.what_offered||x.offer.title)+'</span></div></article>').join(""):'<div class="matchmaker-empty"><strong>Matchmaker is warming up.</strong><p>As organizations publish offers and requests, potential connections will appear here.</p></div>';
}
async function loadCommunityBoard(){
 const [o,a,e]=await Promise.all([
  sb.from("community_opportunities").select("id,opportunity_type,title,organization_name,category,city,description,what_needed,what_offered,website_url,expires_at,created_at").eq("status","published").order("created_at",{ascending:false}).limit(100),
  sb.from("community_announcements").select("id,title,organization_name,category,city,summary,body,link_url,created_at").eq("status","published").order("created_at",{ascending:false}).limit(60),
  sb.from("tacoma_partner_events").select("id,title,organization_name,category,city,venue,address,starts_at,ends_at,description,registration_url").eq("status","published").order("starts_at").limit(100)
 ]);
 if(o.error)$("#opportunityList").innerHTML='<p class="muted">Opportunities are temporarily unavailable.</p>';else{opportunityRows=o.data||[];renderOpportunities();}
 if(a.error)$("#announcementList").innerHTML='<p class="muted">Announcements are temporarily unavailable.</p>';else{announcementRows=a.data||[];renderAnnouncements();}
 if(e.error)$("#eventList").innerHTML='<p class="muted">Events are temporarily unavailable.</p>';else{eventRows=e.data||[];renderEvents();}
}
function renderAnnouncements(){
 $("#announcementList").innerHTML=announcementRows.length?announcementRows.map(a=>'<article class="board-card"><div class="board-card-meta"><span>PARTNER ANNOUNCEMENT</span><span>'+esc(a.category)+'</span></div><h4>'+esc(a.title)+'</h4><p class="board-org">'+esc(a.organization_name)+' · '+esc(a.city)+'</p><p>'+esc(a.summary)+'</p><details class="announcement-more"><summary>Read announcement</summary><p>'+esc(a.body)+'</p></details>'+(safeUrl(a.link_url)?'<a class="board-link" href="'+esc(safeUrl(a.link_url))+'" target="_blank" rel="noopener noreferrer">More information ↗</a>':'')+'</article>').join(""):'<p class="muted">No partner announcements have been published yet.</p>';
}
function renderEvents(){
 const label=eventMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
 $("#eventsMonth").textContent=label;
 const year=eventMonth.getFullYear(),month=eventMonth.getMonth();
 const rows=eventRows.filter(e=>{const d=new Date(e.starts_at);return d.getFullYear()===year&&d.getMonth()===month;});
 $("#eventList").innerHTML=rows.length?rows.map(e=>{
  const d=new Date(e.starts_at),date=d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}),time=d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  return '<article class="board-card event-card"><div class="event-date"><strong>'+d.getDate()+'</strong><span>'+d.toLocaleDateString(undefined,{month:"short"})+'</span></div><div class="board-card-meta"><span>'+esc(e.category)+'</span><span>'+esc(e.city)+'</span></div><h4>'+esc(e.title)+'</h4><p class="board-org">'+esc(e.organization_name)+'</p><p>'+esc(date)+' · '+esc(time)+(e.ends_at?' – '+esc(new Date(e.ends_at).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})):'')+'</p>'+(e.venue?'<p>'+esc(e.venue)+(e.address?' · '+esc(e.address):'')+'</p>':'')+'<p>'+esc(e.description)+'</p>'+(safeUrl(e.registration_url)?'<a class="board-link" href="'+esc(safeUrl(e.registration_url))+'" target="_blank" rel="noopener noreferrer">Event details / registration ↗</a>':'')+'</article>';
 }).join(""):'<p class="muted">No events are listed for this month yet. Use the submission form to share an upcoming community event.</p>';
}
$("#opportunityFilter").addEventListener("change",renderOpportunities);
$("#eventsPrev").addEventListener("click",()=>{eventMonth.setMonth(eventMonth.getMonth()-1);renderEvents();});
$("#eventsNext").addEventListener("click",()=>{eventMonth.setMonth(eventMonth.getMonth()+1);renderEvents();});
function formObject(form,exclude=[]){const f=new FormData(form),o={};for(const [k,v] of f.entries())if(!exclude.includes(k)&&k!=="website_trap"&&String(v).trim()!=="")o[k]=String(v).trim();return o;}
function bindBoardForm(id,feedbackId,table,transform){
 const form=$(id),feedback=$(feedbackId);if(!form)return;
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();feedback.textContent="";feedback.className="form-feedback";
  if(!form.reportValidity())return;
  const f=new FormData(form);if(String(f.get("website_trap")||"").trim())return;
  const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Submitting for review…";
  try{
   const payload=transform?transform(formObject(form)):formObject(form);
   payload.status="pending";
   const {error}=await sb.from(table).insert(payload);
   if(error)throw error;
   feedback.textContent="Thank you. Your submission has been received and is awaiting CrowRules review.";
   feedback.classList.add("success");form.reset();
  }catch(err){console.error("Community submission:",err);feedback.textContent=err.message||"Submission failed. Please try again later.";feedback.classList.add("error");}
  finally{button.disabled=false;button.textContent=table==="community_opportunities"?"Submit opportunity ↗":table==="community_announcements"?"Submit announcement ↗":"Submit event ↗";}
 });
}
bindBoardForm("#opportunityForm","#opportunityFeedback","community_opportunities");
bindBoardForm("#announcementForm","#announcementFeedback","community_announcements");
bindBoardForm("#eventForm","#eventFeedback","tacoma_partner_events",o=>({...o,starts_at:new Date(o.starts_at).toISOString(),ends_at:o.ends_at?new Date(o.ends_at).toISOString():null}));
loadCommunityBoard();
