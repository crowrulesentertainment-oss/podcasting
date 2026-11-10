import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const categories=["Food & Beverage","Small Business & Retail","Arts, Culture & Entertainment","Nonprofits & Charities","Education & Youth","Health & Wellness","Sports & Recreation","Community Organizations","Professional Services","Creators & Media"];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("#year").textContent=new Date().getFullYear();
const menu=$("#mainNav"),toggle=$("#menuToggle");
toggle.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");toggle.setAttribute("aria-expanded","false");}));
const filter=$("#categoryFilter");categories.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;filter.append(o);});
let partners=[];
function render(){
 const q=$("#partnerSearch").value.trim().toLowerCase(),cat=filter.value;
 const rows=partners.filter(p=>(!cat||p.category===cat)&&(!q||[p.organization_name,p.short_description,p.category,p.city].join(" ").toLowerCase().includes(q)));
 $("#partnerCount").textContent=partners.length+" APPROVED PARTNER"+(partners.length===1?"":"S");
 $("#partnerDirectory").innerHTML=rows.length?rows.map(p=>'<article class="partner-card">'+(p.logo_url&&/^https:\/\//i.test(p.logo_url)?'<img src="'+esc(p.logo_url)+'" alt="'+esc(p.organization_name)+' logo" loading="lazy">':'<div class="monogram">'+esc(p.organization_name.slice(0,2).toUpperCase())+'</div>')+'<div class="partner-category">'+esc(p.category||"COMMUNITY PARTNER")+'</div><h3>'+esc(p.organization_name)+'</h3><p>'+esc(p.short_description||"A member of the CrowRules Tacoma Community Partner Network.")+'</p>'+(p.city?'<p>'+esc(p.city)+'</p>':"")+(p.website_url&&/^https:\/\//i.test(p.website_url)?'<a href="'+esc(p.website_url)+'" target="_blank" rel="noopener noreferrer">Visit website ↗</a>':"")+'</article>').join(""):'<div class="empty-state"><div class="empty-symbol">✦</div><h3>No matching partners yet.</h3><p>Try another search or category. Our directory will grow as partners are approved.</p></div>';
}
async function loadPartners(){
 const box=$("#partnerDirectory");
 try{
  const {data,error}=await sb.from("podcast_public_partners").select("id,organization_name,short_description,category,logo_url,website_url,is_active,sort_order").eq("is_active",true).order("sort_order").order("organization_name");
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