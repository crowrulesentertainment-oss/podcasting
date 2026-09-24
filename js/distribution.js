import {getSupabase} from "./supabase.js";
const supabase=await getSupabase();
const el=document.querySelector("#distributionList");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
async function load(){
 if(!supabase){el.innerHTML='<div class="panel empty"><h2>Podcast catalog unavailable.</h2><p>Supabase is not configured.</p></div>';return}
 const {data,error}=await supabase.from("podcasts").select("id,title,slug,description,artwork_url,status,category,subcategory,author_name,author_email,language,copyright,explicit_content,trailer_url,website_url,social_links").eq("status","published").order("title");
 if(error){el.innerHTML='<div class="panel empty"><h2>Unable to load distribution catalog.</h2><p>'+esc(error.message)+'</p></div>';return}
 if(!data?.length){el.innerHTML='<div class="panel empty"><h2>No published podcasts yet.</h2><p>Publish a podcast and its RSS feed will appear here.</p></div>';return}
 const base="https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcast-rss?slug=";
 el.innerHTML=data.map(p=>'<article class="workspace-row"><div class="workspace-art">'+(p.artwork_url?'<img src="'+esc(p.artwork_url)+'" alt="">':'<span>CR</span>')+'</div><div class="workspace-main"><div class="eyebrow">'+esc(p.category||"PODCAST")+'</div><h2>'+esc(p.title)+'</h2><p>'+esc(p.description||"Live CrowRules podcast feed.")+'</p><div class="muted">RSS feed • Updates from published episodes</div><div class="muted">Author: '+esc(p.author_name||"—")+' • '+esc(p.language||"en-us")+' • '+(p.explicit_content?"Explicit":"Clean")+'</div><div class="muted">Directory readiness: '+([p.title,p.description,p.author_name,p.author_email,p.language,p.category,p.artwork_url,p.website_url].every(Boolean)?"READY":"NEEDS METADATA")+'</div></div><div class="workspace-actions"><a class="btn primary" target="_blank" rel="noopener" href="'+base+encodeURIComponent(p.slug)+'">Open RSS</a><button class="btn" data-copy="'+base+encodeURIComponent(p.slug)+'">Copy feed</button></div></article>').join("");
 el.addEventListener("click",async e=>{const b=e.target.closest("[data-copy]");if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copied";setTimeout(()=>b.textContent="Copy feed",1600)}catch{prompt("Copy RSS feed URL:",b.dataset.copy)}});
}
load();