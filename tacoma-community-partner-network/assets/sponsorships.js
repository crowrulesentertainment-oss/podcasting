import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://cevylpnoexugwgygvtgu.supabase.co","sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-");
const form=document.querySelector("#sponsorshipForm"),feedback=document.querySelector("#sponsorFeedback"),button=form.querySelector('button[type="submit"]');
form.addEventListener("submit",async event=>{
 event.preventDefault();feedback.textContent="";feedback.className="sponsor-feedback";
 if(!form.reportValidity())return;
 const f=new FormData(form);
 if(String(f.get("company_website")||"").trim())return;
 const data={name:String(f.get("name")||"").trim(),organization:String(f.get("organization")||"").trim(),email:String(f.get("email")||"").trim(),website_url:String(f.get("website")||"").trim(),interest:"sponsorship",company_website:"",message:[
 "INQUIRY TYPE: SPONSORSHIP",
 "City/community: "+String(f.get("city")||"").trim(),
 "Sponsorship opportunity: "+String(f.get("sponsorship_type")||""),
 "Campaign goal: "+String(f.get("goal")||""),
 "Preferred timing: "+String(f.get("timing")||"Not specified"),
 "Estimated contribution: "+String(f.get("budget")||"Prefer to discuss"),
 "",
 String(f.get("message")||"").trim(),
 "",
 "Consent: User confirmed this is an inquiry only; no paid agreement exists."
 ].join("\n")};
 button.disabled=true;button.textContent="Sending inquiry…";
 try{
  const {data:result,error}=await sb.functions.invoke("partnership-application",{body:data});
  if(error){let detail="";try{detail=(await error.context?.json())?.error||"";}catch{}throw new Error(detail||error.message||"The inquiry could not be confirmed.");}
  if(!result?.ok)throw new Error(result?.error||"The inquiry could not be confirmed.");
  feedback.textContent=result.notification_sent===false?"Your sponsorship inquiry was saved, but the email notification could not be confirmed. The team can review it in the administration center.":"Thank you. Your sponsorship inquiry has been received and saved for the CrowRules team to review.";
  feedback.classList.add("success");form.reset();
 }catch(error){console.error(error);feedback.textContent=error.message||"We could not submit your inquiry. Please try again or email crowrulesentertainment@gmail.com.";feedback.classList.add("error");}
 finally{button.disabled=false;button.innerHTML='Send sponsorship inquiry <span>↗</span>';}
});
