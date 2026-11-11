import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const menu=$("#mainNav"),toggle=$("#menuToggle");
toggle?.addEventListener("click",()=>{const open=menu.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
menu?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");toggle?.setAttribute("aria-expanded","false");}));
const interest=$("#primaryInterest");
document.querySelectorAll("[data-interest]").forEach(button=>button.addEventListener("click",()=>{interest.value=button.dataset.interest;$("#apply").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});interest.focus({preventScroll:true});}));
const form=$("#creatorForm"),feedback=$("#creatorFeedback"),submit=form.querySelector('button[type="submit"]');
form.addEventListener("submit",async event=>{
 event.preventDefault();feedback.textContent="";feedback.className="cg-feedback";
 if(!form.reportValidity())return;
 const f=new FormData(form);
 if(String(f.get("company_website")||"").trim())return;
 submit.disabled=true;submit.textContent="Sending introduction…";
 const message=[
 "Creator & Guest Network introduction",
 "Primary interest: "+String(f.get("primary_interest")||""),
 "City / region: "+String(f.get("city")||"Not provided"),
 "Work samples: "+String(f.get("work_samples")||"Not provided"),
 "",
 "Introduction:",
 String(f.get("message")||"")
 ].join("\n");
 try{
  const {data,error}=await sb.functions.invoke("partnership-application",{body:{
   name:String(f.get("name")||"").trim(),
   organization:String(f.get("organization")||"").trim(),
   email:String(f.get("email")||"").trim(),
   interest:"partnership",
   website_url:String(f.get("website")||"").trim(),
   company_website:"",
   message
  }});
  if(error){let detail="";try{detail=(await error.context?.json())?.error||"";}catch{}throw new Error(detail||error.message||"The introduction could not be confirmed.");}
  if(!data?.ok)throw new Error(data?.error||"The introduction could not be confirmed.");
  feedback.textContent=data.notification_sent===false?"Your introduction was saved, but an email notification could not be confirmed. The team can review it in the administration center.":"Thank you. Your introduction has been received. The CrowRules team will review it and follow up if there is a potential fit.";
  feedback.classList.add("success");form.reset();
 }catch(error){console.error("Creator/guest introduction:",error);feedback.textContent=error.message||"We couldn't send your introduction. Please try again or email crowrulesentertainment@gmail.com.";feedback.classList.add("error");}
 finally{submit.disabled=false;submit.textContent="Send my introduction ↗";}
});