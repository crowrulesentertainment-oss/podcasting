import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const categories=["Food & Beverage","Small Business & Retail","Arts, Culture & Entertainment","Nonprofits & Charities","Education & Youth","Health & Wellness","Sports & Recreation","Community Organizations","Professional Services","Creators & Media"];
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
 const message="Category: "+type+"\nCity/community: "+String(f.get("city")||"").trim()+"\nPhone: "+String(f.get("phone")||"").trim()+"\nWho they serve: "+String(f.get("audience")||"Not specified").trim()+"\nCollaboration interest: "+String(f.get("collaboration")||"Not specified").trim()+"\n\n"+String(f.get("message")||"").trim();
 try{
  const logoFile=logoInput.files?.[0];
  const logoPayload=logoFile?{logo_data:await fileToBase64(logoFile),logo_content_type:logoFile.type}: {};
  const {data,error}=await sb.functions.invoke("partnership-application",{body:{name:String(f.get("name")||"").trim(),organization:String(f.get("organization")||"").trim(),email:String(f.get("email")||"").trim(),interest:"partnership",message,website_url:website,company_website:String(f.get("company_website")||"").trim(),...logoPayload}});
  if(error||!data?.ok)throw new Error(data?.error||error?.message||"The application could not be confirmed.");
  feedback.textContent=data.notification_sent===false?"Your application was saved, but the email notification could not be confirmed. The team can review it in the administration center.":"Thank you. Your application has been received and saved. The CrowRules team will review it.";
  feedback.classList.add("success");form.reset();clearLogo();
 }catch(err){console.error(err);feedback.textContent=err.message||"We couldn't submit your application. Please try again or email crowrulesentertainment@gmail.com.";feedback.classList.add("error");}
 finally{button.disabled=false;button.innerHTML='Submit partner application <span>↗</span>';}
});