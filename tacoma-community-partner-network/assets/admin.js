import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const $=s=>document.querySelector(s),login=$("#loginPanel"),dashboard=$("#dashboard"),form=$("#partnerEditor");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch{return "";}};
function message(id,text,error=false){const el=$(id);el.textContent=text;el.style.color=error?"#ffaaa4":"var(--gold)";}
function clearForm(){form.reset();$("#logoUploadPreview").hidden=true;$("#logoUploadPreview").removeAttribute("src");$("#coverUploadPreview").hidden=true;$("#coverUploadPreview").removeAttribute("src");form.elements.id.value="";form.elements.is_active.checked=true;form.elements.is_featured.checked=false;form.elements.sort_order.value="100";form.elements.verification_status.value="pending";$("#editorTitle").textContent="Add a partner listing";}
function setEditor(p){
 form.elements.logo_file.value="";form.elements.cover_file.value="";
 $("#logoUploadPreview").src=p.logo_url||"";$("#logoUploadPreview").hidden=!p.logo_url;
 $("#coverUploadPreview").src=p.cover_image_url||"";$("#coverUploadPreview").hidden=!p.cover_image_url;
 form.elements.id.value=p.id;
 for(const k of ["organization_name","category","short_description","website_url","logo_url","cover_image_url","recognition_tier","sort_order","city","mission","full_description","public_email","public_phone","facebook_url","instagram_url","youtube_url","verification_status"])form.elements[k].value=p[k]??"";
 form.elements.is_active.checked=!!p.is_active;form.elements.is_featured.checked=!!p.is_featured;
 $("#editorTitle").textContent="Edit partner listing";
}
async function load(){
 const body=$("#partnerRows");body.innerHTML="<tr><td colspan='5'>Loading partner records…</td></tr>";
 const {data,error}=await sb.from("podcast_public_partners").select("id,organization_name,category,short_description,website_url,logo_url,cover_image_url,recognition_tier,is_active,is_featured,sort_order,city,mission,full_description,public_email,public_phone,facebook_url,instagram_url,youtube_url,verification_status,verified_at").order("sort_order").order("organization_name");
 if(error){body.innerHTML="<tr><td colspan='5'>Partner records could not be loaded.</td></tr>";message("#listMessage",error.message,true);return;}
 body.innerHTML=data?.length?data.map(p=>'<tr><td><strong>'+esc(p.organization_name)+'</strong><br><small>'+esc(p.city||"")+'</small></td><td>'+esc(p.category)+'</td><td>'+(p.is_active?"Published":"Unpublished")+'</td><td>'+(p.is_featured?"Yes":"No")+'</td><td>'+esc(p.verification_status||"pending")+'<br><button type="button" data-edit="'+esc(p.id)+'">Edit</button></td></tr>').join(""):"<tr><td colspan='5'>No partner records found.</td></tr>";
 body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const p=data.find(x=>String(x.id)===b.dataset.edit);if(p)setEditor(p);window.scrollTo({top:0,behavior:"smooth"});}));
}
const statuses=[["new","New"],["reviewing","Reviewing"],["contacted","Contacted"],["qualified","Approved / qualified"],["closed","Closed / declined"],["spam","Spam"]];
async function loadApplications(){
 const body=$("#applicationRows");body.innerHTML="<tr><td colspan='5'>Loading applications…</td></tr>";
 const {data,error}=await sb.from("business_inquiries").select("id,name,organization,email,interest,message,status,notes,created_at").eq("interest","partnership").order("created_at",{ascending:false}).limit(100);
 if(error){body.innerHTML="<tr><td colspan='5'>Applications could not be loaded.</td></tr>";message("#applicationMessage",error.message,true);return;}
 if(!data?.length){body.innerHTML="<tr><td colspan='5'>No partner applications found.</td></tr>";return;}
 body.innerHTML=data.map(a=>{
  const options=statuses.map(([v,l])=>'<option value="'+v+'" '+(a.status===v?"selected":"")+'>'+l+'</option>').join("");
  const date=a.created_at?new Date(a.created_at).toLocaleString():"";
  return '<tr><td><strong>'+esc(a.organization||"Organization not provided")+'</strong><br>'+esc(a.name)+'<details class="application-detail"><summary>Read application</summary><pre>'+esc(a.message)+'</pre></details></td><td><a href="mailto:'+encodeURIComponent(a.email)+'">'+esc(a.email)+'</a></td><td>'+esc(date)+'</td><td><select data-status="'+esc(a.id)+'">'+options+'</select></td><td><textarea data-notes="'+esc(a.id)+'" rows="3" placeholder="Private review notes">'+esc(a.notes||"")+'</textarea><button type="button" data-save-app="'+esc(a.id)+'">Save review</button></td></tr>';
 }).join("");
 body.querySelectorAll("[data-save-app]").forEach(b=>b.addEventListener("click",async()=>{
  const id=b.dataset.saveApp,status=body.querySelector('[data-status="'+id+'"]').value,notes=body.querySelector('[data-notes="'+id+'"]').value.trim();
  b.disabled=true;b.textContent="Saving…";
  const {error}=await sb.from("business_inquiries").update({status,notes,updated_at:new Date().toISOString()}).eq("id",id);
  b.disabled=false;b.textContent="Save review";
  if(error){message("#applicationMessage",error.message,true);return;}
  message("#applicationMessage","Application review saved.");
 }));
}
async function loadAnalytics(){
 const liveEl=$("#analyticsLive"),visitorsEl=$("#analyticsVisitors"),viewsEl=$("#analyticsPageviews"),todayEl=$("#analyticsToday");
 message("#analyticsMessage","Refreshing analytics…");
 try{
  const {data:live,error:liveError}=await sb.rpc("partner_network_live_visitors");if(liveError)throw liveError;
  const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const {data,error}=await sb.from("partner_network_analytics").select("visitor_id,page_path,event_type,created_at").gte("created_at",since).order("created_at",{ascending:false}).limit(10000);
  if(error)throw error;
  const rows=data||[],pageviews=rows.filter(x=>x.event_type==="pageview"),unique=new Set(rows.map(x=>x.visitor_id));
  const todayKey=new Date().toISOString().slice(0,10),todayVisitors=new Set(rows.filter(x=>x.created_at.slice(0,10)===todayKey).map(x=>x.visitor_id));
  liveEl.textContent=String(live??0);visitorsEl.textContent=String(unique.size);viewsEl.textContent=String(pageviews.length);todayEl.textContent=String(todayVisitors.size);
  const counts={};pageviews.forEach(x=>{counts[x.page_path]=(counts[x.page_path]||0)+1;});
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $("#analyticsTopPages").innerHTML=top.length?top.map(([path,count])=>`<div class="analytics-row"><span>${esc(path)}</span><strong>${count}</strong></div>`).join(""):"No pageviews recorded yet.";
  const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);const names=new Set(rows.filter(x=>x.created_at.slice(0,10)===key).map(x=>x.visitor_id));days.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),count:names.size});}
  const max=Math.max(1,...days.map(d=>d.count));
  $("#analyticsDaily").innerHTML=days.map(d=>`<div class="analytics-row"><span>${d.label} · ${d.key}</span><strong>${d.count}</strong><div class="analytics-bar" style="grid-column:1/-1"><i style="width:${Math.round(d.count/max*100)}%"></i></div></div>`).join("");
  message("#analyticsMessage","Updated "+new Date().toLocaleTimeString()+".");
 }catch(error){message("#analyticsMessage",error.message||"Analytics could not be loaded.",true);}
}
async function showSession(){
 const {data}=await sb.auth.getSession();const session=data.session;
 login.classList.toggle("hidden",!!session);dashboard.classList.toggle("hidden",!session);
 if(session){await load();await loadApplications();await loadAnalytics();}
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);message("#loginMessage","Signing in…");const {error}=await sb.auth.signInWithPassword({email:String(f.get("email")),password:String(f.get("password"))});if(error){message("#loginMessage",error.message,true);return;}await showSession();});
$("#signOut").addEventListener("click",async()=>{await sb.auth.signOut();await showSession();});
$("#clearEditor").addEventListener("click",clearForm);
$("#refreshAnalytics").addEventListener("click",loadAnalytics);
setInterval(()=>{if(!dashboard.classList.contains("hidden"))loadAnalytics();},60000);
const IMAGE_BUCKET="cr-podcast-artwork";
const imageTypes=["image/jpeg","image/png","image/webp","image/gif"];
function bindImagePreview(inputId,previewId){
 const input=$(inputId),preview=$(previewId);
 input.addEventListener("change",()=>{
  const file=input.files?.[0];
  if(!file){preview.hidden=true;preview.removeAttribute("src");return;}
  if(!imageTypes.includes(file.type)){input.value="";preview.hidden=true;message("#saveMessage","Choose a JPG, PNG, WebP or GIF image.",true);return;}
  if(file.size>8*1024*1024){input.value="";preview.hidden=true;message("#saveMessage","Each image must be 8 MB or smaller.",true);return;}
  preview.src=URL.createObjectURL(file);preview.hidden=false;
 });
}
bindImagePreview("#logoFile","#logoUploadPreview");
bindImagePreview("#coverFile","#coverUploadPreview");
async function uploadPartnerImage(file,kind,organization){
 if(!file)return null;
 const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[file.type];
 if(!ext||file.size>8*1024*1024)throw new Error("Invalid "+kind+" image. Use JPG, PNG, WebP or GIF up to 8 MB.");
 const slug=String(organization||"partner").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"partner";
 const path="community-partners/"+slug+"/"+kind+"-"+crypto.randomUUID()+"."+ext;
 const {error}=await sb.storage.from(IMAGE_BUCKET).upload(path,file,{cacheControl:"3600",contentType:file.type,upsert:false});
 if(error)throw error;
 return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const f=new FormData(form),id=String(f.get("id")||""),verification=String(f.get("verification_status")||"pending");
 const organization=String(f.get("organization_name")).trim();
 const saveButton=form.querySelector('button[type="submit"]');
 saveButton.disabled=true;message("#saveMessage","Uploading images and saving partner listing…");
 try{
  let logoUrl=String(f.get("logo_url")||"").trim()||null;
  let coverUrl=String(f.get("cover_image_url")||"").trim()||null;
  const logoFile=form.elements.logo_file.files?.[0],coverFile=form.elements.cover_file.files?.[0];
  if(logoFile)logoUrl=await uploadPartnerImage(logoFile,"logo",organization);
  if(coverFile)coverUrl=await uploadPartnerImage(coverFile,"cover",organization);
  const payload={organization_name:organization,category:String(f.get("category")),short_description:String(f.get("short_description")).trim(),website_url:String(f.get("website_url")||"").trim()||null,logo_url:logoUrl,cover_image_url:coverUrl,recognition_tier:String(f.get("recognition_tier")||"Community Partner"),sort_order:Number(f.get("sort_order")||100),is_active:f.get("is_active")==="on",is_featured:f.get("is_featured")==="on",city:String(f.get("city")||"").trim()||null,mission:String(f.get("mission")||"").trim()||null,full_description:String(f.get("full_description")||"").trim()||null,public_email:String(f.get("public_email")||"").trim()||null,public_phone:String(f.get("public_phone")||"").trim()||null,facebook_url:String(f.get("facebook_url")||"").trim()||null,instagram_url:String(f.get("instagram_url")||"").trim()||null,youtube_url:String(f.get("youtube_url")||"").trim()||null,verification_status:verification,verified_at:verification==="verified"?new Date().toISOString():null};
  const result=id?await sb.from("podcast_public_partners").update(payload).eq("id",id):await sb.from("podcast_public_partners").insert(payload);
  if(result.error)throw result.error;
  message("#saveMessage","Partner listing saved with uploaded images.");
  clearForm();await load();
 }catch(error){message("#saveMessage",error.message||"The partner listing could not be saved.",true);}
 finally{saveButton.disabled=false;}
});
showSession();