import{sb}from"../../assets/js/client.js";
const form=document.querySelector("#podcasterMessageForm");
const status=document.querySelector("#podcasterMessageStatus");
const setStatus=(message,type="")=>{status.textContent=message;status.dataset.type=type};
form?.addEventListener("submit",async event=>{
 event.preventDefault();
 const values=new FormData(form);
 if(String(values.get("website")||"").trim())return;
 const showName=String(values.get("show_name")||"").trim();
 const displayName=String(values.get("display_name")||"").trim();
 const message=String(values.get("message")||"").trim();
 if(!values.get("display_consent")){setStatus("Please confirm permission to display your message.","error");return}
 if(!showName||showName.length>80||!displayName||displayName.length>40||message.length<8||message.length>500){setStatus("Please check the show name, display name, and message length.","error");return}
 const button=form.querySelector('button[type="submit"]');
 button.disabled=true;setStatus("Submitting your message…");
 try{
  const {error}=await sb.from("cr_lounge_messages").insert({room:"podcaster-wall",show_name:showName,display_name:displayName,message,status:"visible"});
  if(error)throw error;
  form.reset();
  setStatus("Your message is now live on the CrowRules Podcasting homepage. Thank you for adding your voice!","success");
 }catch(error){
  console.error("Podcaster message submission failed:",error);
  setStatus("We couldn’t submit your message right now. Please try again in a moment.","error");
 }finally{button.disabled=false}
});
