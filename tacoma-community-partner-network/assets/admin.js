import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const $=s=>document.querySelector(s),login=$("#loginPanel"),dashboard=$("#dashboard"),form=$("#partnerEditor");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch{return "";}};
function message(id,text,error=false){const el=$(id);el.textContent=text;el.style.color=error?"#ffaaa4":"var(--gold)";}
function clearForm(){form.reset();form.elements.id.value="";form.elements.is_active.checked=true;form.elements.is_featured.checked=false;form.elements.sort_order.value="100";form.elements.verification_status.value="pending";$("#editorTitle").textContent="Add a partner listing";}
function setEditor(p){
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
async function showSession(){
 const {data}=await sb.auth.getSession();const session=data.session;
 login.classList.toggle("hidden",!!session);dashboard.classList.toggle("hidden",!session);
 if(session){await load();await loadApplications();}
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);message("#loginMessage","Signing in…");const {error}=await sb.auth.signInWithPassword({email:String(f.get("email")),password:String(f.get("password"))});if(error){message("#loginMessage",error.message,true);return;}await showSession();});
$("#signOut").addEventListener("click",async()=>{await sb.auth.signOut();await showSession();});
$("#clearEditor").addEventListener("click",clearForm);
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;message("#saveMessage","Saving partner listing…");
 const f=new FormData(form),id=String(f.get("id")||""),verification=String(f.get("verification_status")||"pending");
 const payload={organization_name:String(f.get("organization_name")).trim(),category:String(f.get("category")),short_description:String(f.get("short_description")).trim(),website_url:String(f.get("website_url")||"").trim()||null,logo_url:String(f.get("logo_url")||"").trim()||null,cover_image_url:String(f.get("cover_image_url")||"").trim()||null,recognition_tier:String(f.get("recognition_tier")||"Community Partner"),sort_order:Number(f.get("sort_order")||100),is_active:f.get("is_active")==="on",is_featured:f.get("is_featured")==="on",city:String(f.get("city")||"").trim()||null,mission:String(f.get("mission")||"").trim()||null,full_description:String(f.get("full_description")||"").trim()||null,public_email:String(f.get("public_email")||"").trim()||null,public_phone:String(f.get("public_phone")||"").trim()||null,facebook_url:String(f.get("facebook_url")||"").trim()||null,instagram_url:String(f.get("instagram_url")||"").trim()||null,youtube_url:String(f.get("youtube_url")||"").trim()||null,verification_status:verification,verified_at:verification==="verified"?new Date().toISOString():null};
 const result=id?await sb.from("podcast_public_partners").update(payload).eq("id",id):await sb.from("podcast_public_partners").insert(payload);
 if(result.error){message("#saveMessage",result.error.message,true);return;}
 message("#saveMessage","Partner listing saved.");clearForm();await load();
});
showSession();