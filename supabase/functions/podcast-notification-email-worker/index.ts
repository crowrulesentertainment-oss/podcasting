import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";

const FROM = Deno.env.get("PODCAST_EMAIL_FROM") || "CrowRules Podcasting <onboarding@resend.dev>";
const MAX = 5;
const out = (x, s=200) => new Response(JSON.stringify(x), {status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\"","&quot;");

function gmailBase64(value:string):string{const bytes=new TextEncoder().encode(value);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function gmailBase64Lines(value:string):string{return value.match(/.{1,76}/g)?.join("\r\n")||"";}
async function gmailAccessToken():Promise<string>{const clientId=Deno.env.get("GOOGLE_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET"),refreshToken=Deno.env.get("GOOGLE_REFRESH_TOKEN"),sender=Deno.env.get("GOOGLE_SENDER_EMAIL");if(!clientId||!clientSecret||!refreshToken||!sender)throw new Error("Gmail OAuth secrets are incomplete.");const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.access_token)throw new Error("Google OAuth token refresh failed: "+String(data.error_description||data.error||response.status).slice(0,300));return data.access_token;}
async function sendGmailMessage(args:{accessToken:string,to:string,subject:string,text:string,html:string,unsubscribeUrl?:string,attachments?:Array<{filename:string,contentType:string,content:string}>}):Promise<any>{const sender=Deno.env.get("GOOGLE_SENDER_EMAIL")||"";if(!sender)throw new Error("GOOGLE_SENDER_EMAIL is not configured.");const alt="cr_alt_"+crypto.randomUUID().replace(/-/g,""),mixed="cr_mix_"+crypto.randomUUID().replace(/-/g,"");const subjectHeader="=?UTF-8?B?"+gmailBase64(args.subject.replace(/[\r\n]/g," "))+"?=";const unsubscribeHeaders=args.unsubscribeUrl?["List-Unsubscribe: <"+args.unsubscribeUrl+">","List-Unsubscribe-Post: List-Unsubscribe=One-Click"]:[];const alternative=["--"+alt,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: base64","",gmailBase64Lines(gmailBase64(args.text)),"--"+alt,'Content-Type: text/html; charset="UTF-8"',"Content-Transfer-Encoding: base64","",gmailBase64Lines(gmailBase64(args.html)),"--"+alt+"--",""].join("\r\n");let mime:string[];if(args.attachments?.length){mime=["From: CrowRules Podcasting <"+sender+">","To: "+args.to.replace(/[\r\n]/g,""),"Subject: "+subjectHeader,"MIME-Version: 1.0",...unsubscribeHeaders,'Content-Type: multipart/mixed; boundary="'+mixed+'"',"","--"+mixed,'Content-Type: multipart/alternative; boundary="'+alt+'"',"",alternative];for(const attachment of args.attachments){const filename=attachment.filename.replace(/[^a-zA-Z0-9._-]/g,"_");mime.push("--"+mixed,'Content-Type: '+attachment.contentType+'; name="'+filename+'"','Content-Disposition: attachment; filename="'+filename+'"',"Content-Transfer-Encoding: base64","",gmailBase64Lines(gmailBase64(attachment.content)));}mime.push("--"+mixed+"--","");}else mime=["From: CrowRules Podcasting <"+sender+">","To: "+args.to.replace(/[\r\n]/g,""),"Subject: "+subjectHeader,"MIME-Version: 1.0",...unsubscribeHeaders,'Content-Type: multipart/alternative; boundary="'+alt+'"',"",alternative];const raw=gmailBase64(mime.join("\r\n")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{"Authorization":"Bearer "+args.accessToken,"Content-Type":"application/json"},body:JSON.stringify({raw})});const responseText=await response.text();let data:any={};try{data=JSON.parse(responseText)}catch{}if(!response.ok)throw new Error("Gmail API HTTP "+response.status+": "+responseText.slice(0,500));return data;}
function html(n,unsubscribeUrl?:string){ const a=n.action_url ? "<p><a href=\"" + esc(n.action_url) + "\" style=\"display:inline-block;padding:12px 18px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px;font-weight:700\">Open CrowRules</a></p>" : ""; const u=unsubscribeUrl?"<hr style=\"border:0;border-top:1px solid #1e293b\"><p style=\"font-size:12px;color:#94a3b8\">Roadmap update emails are optional. <a href=\""+esc(unsubscribeUrl)+"\" style=\"color:#67e8f9\">Unsubscribe from roadmap emails</a>.</p>":""; return "<!doctype html><html><body style=\"margin:0;background:#05050b;color:#f5f7ff;font-family:Arial,sans-serif\"><div style=\"max-width:640px;margin:auto;padding:32px 20px\"><div style=\"color:#67e8f9;font-weight:700;letter-spacing:2px\">CROWRULES PODCASTING</div><h1>"+esc(n.title)+"</h1><p style=\"line-height:1.7;color:#cbd5e1\">"+esc(n.body)+"</p>"+a+u+"<hr style=\"border:0;border-top:1px solid #1e293b\"><small style=\"color:#64748b\">One Account. One Universe.</small></div></body></html>"; }
async function processCrowSpaceEvents(db){
 const now=new Date(); const in15=new Date(now.getTime()+15*60*1000).toISOString();
 const reminders=await db.from("crowspace_event_reminders").select("id,event_id,user_id,channel,remind_at,status").eq("status","scheduled").lte("remind_at",now.toISOString()).limit(50);
 if(!reminders.error) for(const r of reminders.data||[]){
  if(r.channel==="email"){
   const e=(await db.from("crowspace_events").select("id,title,is_cancelled").eq("id",r.event_id).maybeSingle()).data;
   if(e&&!e.is_cancelled) await db.from("crowspace_event_notifications").upsert({event_id:e.id,user_id:r.user_id,notification_type:"reminder",channel:"email",status:"queued",subject:"Reminder — "+e.title,body:"Your CrowSpace event starts in about 30 minutes.",action_url:"https://crowrulesentertainment-oss.github.io/crowspace/event.html?id="+e.id,dedupe_key:"reminder:"+r.id},{onConflict:"dedupe_key"});
  }
  await db.from("crowspace_event_reminders").update({status:"sent",updated_at:now.toISOString()}).eq("id",r.id).eq("status","scheduled");
 }
 const ev=await db.from("crowspace_events").select("id,title,starts_at,is_cancelled").eq("is_cancelled",false).gte("starts_at",now.toISOString()).lte("starts_at",in15).limit(50);
 if(!ev.error) for(const e of ev.data||[]){ const rs=await db.from("crowspace_event_rsvps").select("user_id,status").eq("event_id",e.id).in("status",["going","interested"]); if(rs.error) continue; for(const r of rs.data||[]) await db.from("crowspace_event_notifications").upsert({event_id:e.id,user_id:r.user_id,notification_type:"event_start",channel:"email",status:"queued",subject:"Starting soon — "+e.title,body:"Your CrowSpace event starts in about 15 minutes.",action_url:"https://crowrulesentertainment-oss.github.io/crowspace/event.html?id="+e.id,dedupe_key:"start:"+e.id+":"+r.user_id},{onConflict:"dedupe_key"}); }
 const jobs=await db.from("crowspace_event_notifications").select("*").eq("status","queued").lte("next_attempt_at",now.toISOString()).order("created_at",{ascending:true}).limit(25);
 let sent=0,failed=0;
 if(!jobs.error) for(const job of jobs.data||[]){
  const c=await db.from("crowspace_event_notifications").update({status:"processing",attempts:(job.attempts||0)+1,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","queued").select("id").maybeSingle(); if(c.error||!c.data) continue;
  if(!RESEND){ await db.from("crowspace_event_notifications").update({status:"failed",last_error:"RESEND_API_KEY is not configured",updated_at:new Date().toISOString()}).eq("id",job.id); failed++; continue; }
  const er=await fetch(URL+"/auth/v1/admin/users/"+encodeURIComponent(job.user_id),{headers:{apikey:KEY,Authorization:"Bearer "+KEY}}); if(!er.ok){await retryCrowSpaceEvent(db,job,"auth_lookup_"+er.status);failed++;continue;}
  const user=await er.json(); const to=user?.email; if(!to){await db.from("crowspace_event_notifications").update({status:"failed",last_error:"recipient_email_not_found",updated_at:new Date().toISOString()}).eq("id",job.id);failed++;continue;}
  const html="<!doctype html><html lang=\"en\"><body style=\"margin:0;background:#03040a;color:#f5f7ff;font-family:Arial,sans-serif\"><div style=\"max-width:640px;margin:auto;padding:32px 20px\"><div style=\"color:#78efff;font-weight:800;letter-spacing:3px\">CROWRULES // CROWSPACE</div><h1>"+esc(job.subject)+"</h1><p style=\"line-height:1.7;color:#cbd5e1\">"+esc(job.body)+"</p>"+(job.action_url?"<p><a href=\""+esc(job.action_url)+"\" style=\"display:inline-block;padding:12px 18px;background:#78efff;color:#061016;text-decoration:none;border-radius:8px;font-weight:800\">OPEN EVENT</a></p>":"")+"<hr style=\"border:0;border-top:1px solid #1e293b\"><small style=\"color:#64748b\">One Account. One Universe.</small></div></body></html>";
  const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+RESEND,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[to],subject:job.subject,html,text:job.subject+"\\n\\n"+job.body+(job.action_url?"\\n\\nOpen: "+job.action_url:"")})}); const p=await rr.json().catch(()=>({}));
  if(!rr.ok){await retryCrowSpaceEvent(db,job,JSON.stringify(p).slice(0,2000));failed++;continue;}
  await db.from("crowspace_event_notifications").update({status:"sent",provider:"resend",provider_message_id:p?.id||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id); sent++;
 }
 return {sent,failed};
}
async function retryCrowSpaceEvent(db,job,error){const attempts=(job.attempts||0)+1;const terminal=attempts>=MAX;const delay=Math.min(3600,30*Math.pow(2,Math.min(attempts,7)));await db.from("crowspace_event_notifications").update({status:terminal?"failed":"queued",next_attempt_at:new Date(Date.now()+delay*1000).toISOString(),last_error:error,updated_at:new Date().toISOString()}).eq("id",job.id);}

async function main(req){
 if(!URL||!KEY) return out({ok:false,error:"server_credentials_unconfigured"},503);
 const secret=req.headers.get("x-crowrules-worker-secret")||"";
 const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.57.4");
 const db=createClient(URL,KEY,{auth:{persistSession:false}});
 const auth=await db.rpc("podcast_email_worker_authorized",{p_secret:secret});
 if(auth.error||auth.data!==true) return out({ok:false,error:"unauthorized_worker"},401);
 
 let body={}; try{body=await req.json()}catch{}
 let job;
 if(body.job_id){ job=(await db.from("podcast_notification_delivery_queue").select("*").eq("id",body.job_id).eq("channel","email").maybeSingle()).data; }
 else { const r=await db.rpc("podcast_claim_notification_email_job",{p_max_attempts:MAX}); if(r.error) throw r.error; job=r.data?.[0]||null; }
 if(!job){ const eventResult=await processCrowSpaceEvents(db); return out({ok:true,status:"idle",eventResult}); }
 const nr=await db.from("podcast_live_notifications").select("id,user_id,title,body,action_url,notification_type,metadata,priority").eq("id",job.notification_id).maybeSingle();
 if(nr.error||!nr.data) throw nr.error||new Error("notification_not_found");
 const er=await fetch(URL+"/auth/v1/admin/users/"+encodeURIComponent(nr.data.user_id),{headers:{apikey:KEY,Authorization:"Bearer "+KEY}});
 if(!er.ok) throw new Error("auth_lookup_"+er.status);
 const user=await er.json(); const to=user?.email;
 if(!to){await db.from("podcast_notification_delivery_queue").update({status:"failed",last_error:"recipient_email_not_found",locked_at:null,updated_at:new Date().toISOString()}).eq("id",job.id);return out({ok:false,status:"failed",job_id:job.id},422);}
 let unsubscribeUrl:string|undefined;
 if(nr.data.notification_type==="development_roadmap_update"){
  const pref=await db.from("podcast_notification_preferences").select("email_enabled,roadmap_email_enabled,roadmap_email_unsubscribe_token").eq("user_id",nr.data.user_id).maybeSingle();
  if(pref.error)throw pref.error;
  if(!pref.data?.email_enabled||!pref.data?.roadmap_email_enabled||!user?.email_confirmed_at){
   await db.from("podcast_notification_delivery_queue").update({status:"suppressed",last_error:"Member email preference disabled or account email is unconfirmed.",locked_at:null,updated_at:new Date().toISOString()}).eq("id",job.id);
   return out({ok:true,status:"suppressed",job_id:job.id});
  }
  unsubscribeUrl=URL+"/functions/v1/podcast-roadmap-email-unsubscribe?token="+encodeURIComponent(pref.data.roadmap_email_unsubscribe_token);
 }
 const attempts=job.attempts||1;
 let p:any;
 try{
  const accessToken=await gmailAccessToken();
  const plainText=nr.data.title+"\n\n"+nr.data.body+(nr.data.action_url?"\n\nOpen: "+nr.data.action_url:"")+(unsubscribeUrl?"\n\nUnsubscribe from roadmap emails: "+unsubscribeUrl:"");
  p=await sendGmailMessage({accessToken,to,subject:"CrowRules Podcasting — "+nr.data.title,html:html(nr.data,unsubscribeUrl),text:plainText,unsubscribeUrl});
 }catch(e){
  const terminal=attempts>=MAX;const delay=Math.min(3600,30*Math.pow(2,Math.min(attempts,7)));
  await db.from("podcast_notification_delivery_queue").update({status:terminal?"failed":"queued",next_attempt_at:new Date(Date.now()+delay*1000).toISOString(),last_error:String(e?.message||e).slice(0,2000),locked_at:null,updated_at:new Date().toISOString()}).eq("id",job.id);
  return out({ok:false,status:"delivery_failed",job_id:job.id,retryable:!terminal},502);
 }
 await db.from("podcast_notification_delivery_queue").update({status:"sent",provider:"gmail",provider_message_id:p?.id||null,delivered_at:new Date().toISOString(),locked_at:null,updated_at:new Date().toISOString()}).eq("id",job.id);
 await db.from("podcast_live_notifications").update({email_delivery_state:"sent",delivery_state:"email_sent"}).eq("id",nr.data.id);
 return out({ok:true,status:"sent",job_id:job.id,provider:"gmail",provider_message_id:p?.id||null}); }
Deno.serve(async req=>{if(req.method!=="POST")return out({ok:false,error:"method_not_allowed"},405);try{return await main(req)}catch(e){return out({ok:false,error:String(e?.message||e)},500)}});