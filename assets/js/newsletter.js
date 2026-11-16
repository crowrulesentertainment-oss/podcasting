import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from"./config.js";
const endpoint=SUPABASE_URL+"/functions/v1/podcasting-newsletter";
async function request(action,values={}){const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action,...values})});const data=await response.json().catch(()=>({error:"The newsletter service returned an unreadable response."}));if(!response.ok)throw new Error(data.error||"Newsletter request failed.");return data}
export function initNewsletterSignup(root=document){
 const form=root.querySelector("#crNewsletterSignup");if(!form||form.dataset.ready)return;form.dataset.ready="1";
 const status=root.querySelector("#crNewsletterStatus"),button=form.querySelector("button[type=submit]");
 form.addEventListener("submit",async event=>{event.preventDefault();const email=form.querySelector('[name="email"]').value.trim();button.disabled=true;status.textContent="Submitting your subscription…";status.className="cr-newsletter-status";
  try{const result=await request("subscribe",{email,website:form.querySelector('[name="website"]').value,source:"podcasting_homepage"});status.textContent=result.message||"Check your inbox to confirm your subscription.";status.classList.add("good");form.reset()}
  catch(error){status.textContent=error.message;status.classList.add("warn")}
  finally{button.disabled=false}
 });
}
async function handleAction(){
 const params=new URLSearchParams(location.search),confirmToken=params.get("confirm"),unsubscribeToken=params.get("unsubscribe"),status=document.querySelector("#crNewsletterActionStatus");
 if(!status||(!confirmToken&&!unsubscribeToken))return;
 status.textContent=confirmToken?"Confirming your subscription…":"Processing your unsubscribe request…";
 try{const result=await request(confirmToken?"confirm":"unsubscribe",{token:confirmToken||unsubscribeToken});status.textContent=result.message;status.classList.add("good")}
 catch(error){status.textContent=error.message;status.classList.add("warn")}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{initNewsletterSignup();handleAction()});else{initNewsletterSignup();handleAction()}
