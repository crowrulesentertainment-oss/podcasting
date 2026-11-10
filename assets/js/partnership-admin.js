import { sb } from "./client.js";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const status = $("#adminStatus"), app = $("#adminApp"), form = $("#partnerEditor");
let inquiries = [], partners = [], events = [];
const show = (message, kind="") => {status.textContent=message;status.className="admin-message "+kind;};
async function init(){
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){show("Please sign in with your CrowRules administrator account first. Open the main admin page, sign in, then return here.","bad");return;}
 const {data:auth,error:authError}=await sb.functions.invoke("podcasting-admin-bootstrap",{body:{}});
 if(authError||!auth?.ok||!["active","initialized"].includes(auth.status)){
   show(auth?.message||auth?.error||"Administrator access is pending approval. Sign in with an approved CrowRules administrator account.","bad");
   return;
 }
 app.classList.remove("hidden");
 show("Signed in as "+(user.email||"administrator")+". Data access is protected by database policies.","good");
 await refreshAll();
}
async function refreshAll(){await Promise.all([loadInquiries(),loadPartners(),loadEvents()]);}
async function loadInquiries(){
 const {data,error}=await sb.from("business_inquiries").select("id,name,organization,email,interest,message,status,created_at").order("created_at",{ascending:false}).limit(100);
 if(error){$("#inquiryList").innerHTML='<div class="empty-state">Unable to load inquiries. Confirm administrator permissions.</div>';return;}
 inquiries=data||[];
 $("#inquiryList").innerHTML=inquiries.length?inquiries.map(i=>'<article class="admin-row"><div><h3>'+esc(i.organization||i.name)+'</h3><p>'+esc(i.name)+' · '+esc(i.email)+' · '+esc(i.interest)+' · '+new Date(i.created_at).toLocaleDateString()+'</p><p>'+esc(i.message).replace(/\n/g,"<br>")+'</p></div><div class="admin-row-actions"><select data-inquiry-status="'+esc(i.id)+'">'+["new","reviewing","contacted","qualified","closed","spam"].map(s=>'<option '+(s===i.status?"selected":"")+'>'+s+'</option>').join("")+'</select></div></article>').join(""):'<div class="empty-state">No partnership inquiries yet. New applications will appear here.</div>';
 $("#inquiryList").querySelectorAll("[data-inquiry-status]").forEach(sel=>sel.addEventListener("change",async()=>{const {error}=await sb.from("business_inquiries").update({status:sel.value,updated_at:new Date().toISOString()}).eq("id",sel.dataset.inquiryStatus);if(error)alert("Could not update inquiry: "+error.message);else loadInquiries();}));
}
async function loadPartners(){
 const {data,error}=await sb.from("podcast_public_partners").select("*").order("sort_order").order("organization_name");
 if(error){$("#partnerList").innerHTML='<div class="empty-state">Unable to load partner profiles. Check administrator permissions.</div>';return;}
 partners=data||[];
 $("#partnerList").innerHTML=partners.length?partners.map(p=>'<article class="admin-row"><div><h3>'+esc(p.organization_name)+'</h3><p>'+esc(p.recognition_tier)+' · '+(p.is_active?"Published":"Draft")+(p.is_featured?" · Featured":"")+'</p></div><div class="admin-row-actions"><button class="secondary" data-edit="'+esc(p.id)+'">Edit</button><button class="secondary danger" data-delete="'+esc(p.id)+'">Delete</button></div></article>').join(""):'<div class="empty-state">No partner profiles yet. Add an approved partner above; draft profiles stay off the public directory.</div>';
 $("#partnerList").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editPartner(partners.find(p=>p.id===b.dataset.edit))));
 $("#partnerList").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deletePartner(b.dataset.delete)));
}
function editPartner(p){if(!p)return;for(const [key,value] of Object.entries(p)){const el=form.elements.namedItem(key);if(!el)continue;if(el.type==="checkbox")el.checked=!!value;else if(key==="spotlight_month"&&value)el.value=String(value).slice(0,7);else el.value=value??"";}form.scrollIntoView({behavior:"smooth",block:"center"});}
function resetForm(){form.reset();form.elements.namedItem("id").value="";}
form.addEventListener("submit",async e=>{
 e.preventDefault();const d=new FormData(form),id=String(d.get("id")||"");
 const payload={organization_name:String(d.get("organization_name")).trim(),short_description:String(d.get("short_description")||""),category:String(d.get("category")||"Community Partner"),recognition_tier:String(d.get("recognition_tier")),logo_url:String(d.get("logo_url")||"")||null,website_url:String(d.get("website_url")||"")||null,spotlight_title:String(d.get("spotlight_title")||"")||null,spotlight_month:d.get("spotlight_month")?String(d.get("spotlight_month"))+"-01":null,spotlight_story:String(d.get("spotlight_story")||"")||null,episode_url:String(d.get("episode_url")||"")||null,is_featured:form.elements.namedItem("is_featured").checked,is_active:form.elements.namedItem("is_active").checked,updated_at:new Date().toISOString()};
 const result=id?await sb.from("podcast_public_partners").update(payload).eq("id",id):await sb.from("podcast_public_partners").insert(payload);
 $("#partnerFeedback").textContent=result.error?"Save failed: "+result.error.message:"Partner profile saved.";
 if(!result.error){resetForm();await loadPartners();}
});
async function deletePartner(id){if(!confirm("Delete this partner profile? This cannot be undone."))return;const {error}=await sb.from("podcast_public_partners").delete().eq("id",id);if(error)alert(error.message);else loadPartners();}
async function loadEvents(){
 const since=new Date(Date.now()-30*86400000).toISOString();
 const {data,error}=await sb.from("podcast_partnership_events").select("event_type,partner_id,campaign_key,campaign_source,campaign_medium,referral_code,created_at").gte("created_at",since).order("created_at",{ascending:false}).limit(5000);
 if(error){$("#analyticsSummary").innerHTML='<div class="empty-state">Analytics unavailable. Check administrator permissions.</div>';return;}
 events=data||[];
 const count=t=>events.filter(e=>e.event_type===t).length;
 const metrics=[["Page views",count("page_view")],["Partner clicks",count("partner_click")],["Spotlight clicks",count("spotlight_click")],["Media kit opens",count("media_kit_open")],["Apply clicks",count("apply_click")],["Applications submitted",count("application_submit")]];
 $("#analyticsSummary").innerHTML=metrics.map(m=>'<div class="admin-stat"><b>'+m[1]+'</b><span>'+m[0]+' · 30 days</span></div>').join("");
 const campaigns={};events.forEach(e=>{const key=e.referral_code?"Referral: "+e.referral_code:(e.campaign_key?e.campaign_key+" · "+(e.campaign_source||"source unknown")+" / "+(e.campaign_medium||"medium unknown"):"Un-tagged / direct");campaigns[key]=(campaigns[key]||0)+1;});
 $("#campaignBreakdown").innerHTML='<div class="section-label">CAMPAIGN TAG BREAKDOWN · LAST 30 DAYS</div>'+Object.entries(campaigns).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<article class="admin-row"><div><h3>'+esc(k)+'</h3><p>Recorded engagement events</p></div><b>'+v+'</b></article>').join("")||'<div class="empty-state">No campaign events recorded yet.</div>';
}
$("#refreshInquiries").addEventListener("click",loadInquiries);$("#refreshAnalytics").addEventListener("click",loadEvents);$("#resetPartner").addEventListener("click",resetForm);
init();