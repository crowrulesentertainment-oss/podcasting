import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch{return "";}};
let partners=[];
function render(){
 const q=$("#hqPartnerSearch").value.trim().toLowerCase(),cat=$("#hqPartnerCategory").value;
 const rows=partners.filter(p=>(!cat||p.category===cat)&&(!q||[p.organization_name,p.short_description,p.category,p.city,p.mission,p.full_description].join(" ").toLowerCase().includes(q)));
 $("#hqPartnerCount").textContent=rows.length+" approved partner profile"+(rows.length===1?"":"s");
 $("#hqDirectoryGrid").innerHTML=rows.length?rows.map(p=>{
 const cover=safeUrl(p.cover_image_url),logo=safeUrl(p.logo_url),website=safeUrl(p.website_url);
 return '<article class="partner-card hq-partner-card">'+(cover?'<img class="partner-cover" src="'+esc(cover)+'" alt="" loading="lazy">':'<div class="partner-cover cover-placeholder"></div>')+'<div class="partner-card-body">'+(logo?'<img class="partner-logo" src="'+esc(logo)+'" alt="'+esc(p.organization_name)+' logo" loading="lazy">':'<div class="partner-logo monogram">'+esc((p.organization_name||"CR").slice(0,2).toUpperCase())+'</div>')+'<div class="partner-card-meta"><span class="partner-category">'+esc(p.category||"COMMUNITY PARTNER")+'</span>'+(p.verification_status==="verified"?'<span class="verified-mark">✓ VERIFIED</span>':'')+'</div><h3>'+esc(p.organization_name)+'</h3>'+(p.city?'<p class="partner-location">'+esc(p.city)+'</p>':'')+'<p>'+esc(p.short_description||"A member of the CrowRules Podcasting Partnership Network.")+'</p>'+(p.mission?'<p><strong>Mission:</strong> '+esc(p.mission)+'</p>':'')+'<div class="profile-contact">'+(p.public_email?'<a href="mailto:'+esc(p.public_email)+'">Email ↗</a>':'')+(p.public_phone?'<span>'+esc(p.public_phone)+'</span>':'')+(website?'<a href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">Website ↗</a>':'')+'</div></div></article>';
 }).join(""):'<div class="hq-card"><h2>No profiles match that search.</h2><p>Try a different keyword or category. New partner profiles are published after review.</p></div>';
}
$("#hqPartnerSearch").addEventListener("input",render);$("#hqPartnerCategory").addEventListener("change",render);
try{
 const {data,error}=await sb.from("podcast_public_partners").select("id,organization_name,short_description,category,logo_url,website_url,is_active,is_featured,city,mission,full_description,cover_image_url,public_email,public_phone,verification_status").eq("is_active",true).order("is_featured",{ascending:false}).order("organization_name");
 if(error)throw error;partners=data||[];render();
}catch(error){console.error(error);$("#hqPartnerCount").textContent="The partner directory is temporarily unavailable.";$("#hqDirectoryGrid").innerHTML='<div class="hq-card"><h2>We will be back shortly.</h2><p>You can still submit a partnership application.</p><a href="index.html#apply">Apply to join ↗</a></div>';}
