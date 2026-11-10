import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const $=s=>document.querySelector(s),login=$("#loginPanel"),dashboard=$("#dashboard"),form=$("#partnerEditor");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(id,text,error=false){const el=$(id);el.textContent=text;el.style.color=error?"#ffaaa4":"var(--gold)";}
function clearForm(){form.reset();form.elements.id.value="";form.elements.is_active.checked=true;form.elements.is_featured.checked=false;form.elements.sort_order.value="100";$("#editorTitle").textContent="Add a partner listing";}
function setEditor(p){form.elements.id.value=p.id;for(const k of ["organization_name","category","short_description","website_url","logo_url","recognition_tier","sort_order"])form.elements[k].value=p[k]??"";form.elements.is_active.checked=!!p.is_active;form.elements.is_featured.checked=!!p.is_featured;$("#editorTitle").textContent="Edit partner listing";}
async function load(){
 const body=$("#partnerRows");body.innerHTML="<tr><td colspan='5'>Loading partner records…</td></tr>";
 const {data,error}=await sb.from("podcast_public_partners").select("id,organization_name,category,short_description,website_url,logo_url,recognition_tier,is_active,is_featured,sort_order").order("sort_order").order("organization_name");
 if(error){body.innerHTML="<tr><td colspan='5'>Partner records could not be loaded.</td></tr>";message("#listMessage",error.message,true);return;}
 body.innerHTML=data?.length?data.map(p=>'<tr><td><strong>'+esc(p.organization_name)+'</strong></td><td>'+esc(p.category)+'</td><td>'+(p.is_active?"Published":"Unpublished")+'</td><td>'+(p.is_featured?"Yes":"No")+'</td><td><button type="button" data-edit="'+esc(p.id)+'">Edit</button></td></tr>').join(""):"<tr><td colspan='5'>No partner records found.</td></tr>";
 body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const p=data.find(x=>String(x.id)===b.dataset.edit);if(p)setEditor(p);window.scrollTo({top:0,behavior:"smooth"});}));
}
async function showSession(){
 const {data}=await sb.auth.getSession();const session=data.session;
 login.classList.toggle("hidden",!!session);dashboard.classList.toggle("hidden",!session);
 if(session)await load();
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);message("#loginMessage","Signing in…");const {error}=await sb.auth.signInWithPassword({email:String(f.get("email")),password:String(f.get("password"))});if(error){message("#loginMessage",error.message,true);return;}await showSession();});
$("#signOut").addEventListener("click",async()=>{await sb.auth.signOut();await showSession();});
$("#clearEditor").addEventListener("click",clearForm);
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;message("#saveMessage","Saving partner listing…");
 const f=new FormData(form),id=String(f.get("id")||"");
 const payload={organization_name:String(f.get("organization_name")).trim(),category:String(f.get("category")),short_description:String(f.get("short_description")).trim(),website_url:String(f.get("website_url")||"").trim()||null,logo_url:String(f.get("logo_url")||"").trim()||null,recognition_tier:String(f.get("recognition_tier")||"Community Partner"),sort_order:Number(f.get("sort_order")||100),is_active:f.get("is_active")==="on",is_featured:f.get("is_featured")==="on"};
 const result=id?await sb.from("podcast_public_partners").update(payload).eq("id",id):await sb.from("podcast_public_partners").insert(payload);
 if(result.error){message("#saveMessage",result.error.message,true);return;}
 message("#saveMessage","Partner listing saved.");clearForm();await load();
});
showSession();