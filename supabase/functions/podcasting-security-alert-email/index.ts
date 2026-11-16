import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ORIGIN="https://crowrulesentertainment-oss.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const base64url=(s:string)=>{const b=new TextEncoder().encode(s);let raw="";for(const x of b)raw+=String.fromCharCode(x);return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");};
async function main(req:Request){
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return reply({error:"Method not allowed."},405);
 if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return reply({error:"Origin not allowed."},403);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 const clientId=Deno.env.get("GOOGLE_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET"),refresh=Deno.env.get("GOOGLE_REFRESH_TOKEN"),sender=Deno.env.get("GOOGLE_SENDER_EMAIL");
 if(!url||!service||!anon)return reply({error:"Security email service is not configured."},503);
 if(!clientId||!clientSecret||!refresh||!sender)return reply({error:"Gmail OAuth secrets are incomplete. Configure the existing Podcasting Email Center Gmail secrets."},503);
 const token=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");if(!token)return reply({error:"Sign-in required."},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);if(userError||!user)return reply({error:"Administrator session invalid or expired."},401);
 const scan=await userClient.rpc("podcasting_security_monitor_scan");if(scan.error)return reply({error:"Active Podcasting administrator access required."},403);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const oauth=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})});
 const auth=await oauth.json().catch(()=>({}));if(!oauth.ok||!auth.access_token)return reply({error:"Gmail token refresh failed: "+String(auth.error_description||auth.error||oauth.status).slice(0,250)},502);
 const {data:items,error}=await db.from("podcasting_security_notification_outbox").select("id,alert_id,recipient_email,attempts").eq("status","pending").order("created_at",{ascending:true}).limit(50);if(error)throw error;
 let sent=0,failed=0;
 for(const item of items??[]){const {data:a}=await db.from("podcasting_security_alerts").select("severity,title,summary,source,created_at").eq("id",item.alert_id).maybeSingle();if(!a)continue;
  const subject="[CrowRules Security "+String(a.severity).toUpperCase()+"] "+String(a.title).slice(0,130),body=[a.title,a.summary,"Severity: "+a.severity,"Source: "+a.source,"Detected: "+a.created_at,"Review: https://crowrulesentertainment-oss.github.io/podcasting/admin.html?tab=securityMonitoring"].join("\n\n");
  const html="<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#202124\"><h2>"+String(a.title).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+"</h2><p>"+String(a.summary).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+"</p><p><b>Severity:</b> "+String(a.severity).toUpperCase()+"</p><p><b>Source:</b> "+String(a.source)+"</p><p><a href=\"https://crowrulesentertainment-oss.github.io/podcasting/admin.html?tab=securityMonitoring\">Open Security Monitoring</a></p></body></html>";
  const mime=["From: CrowRules Podcasting <"+sender+">","To: "+item.recipient_email,"Subject: =?UTF-8?B?"+btoa(unescape(encodeURIComponent(subject)))+"?=","MIME-Version: 1.0",'Content-Type: multipart/alternative; boundary="cr_security_alert"',"","--cr_security_alert",'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: base64","",btoa(unescape(encodeURIComponent(body))),"--cr_security_alert",'Content-Type: text/html; charset="UTF-8"',"Content-Transfer-Encoding: base64","",btoa(unescape(encodeURIComponent(html))),"--cr_security_alert--",""].join("\r\n");
  try{const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:"Bearer "+auth.access_token,"Content-Type":"application/json"},body:JSON.stringify({raw:base64url(mime)})});const payload=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(payload.error?.message||r.status).slice(0,400));await db.from("podcasting_security_notification_outbox").update({status:"sent",attempts:item.attempts+1,provider_message_id:payload.id??null,sent_at:new Date().toISOString(),last_error:null}).eq("id",item.id);sent++}
  catch(e){await db.from("podcasting_security_notification_outbox").update({status:"failed",attempts:item.attempts+1,last_error:String(e?.message||e).slice(0,500)}).eq("id",item.id);failed++}
 }
 return reply({ok:true,queued:items?.length??0,sent,failed});
}
Deno.serve(async(req:Request)=>{try{return await main(req)}catch(e){console.error("Security alert email dispatch failed:",e);return reply({error:"Security email dispatch failed: "+String(e?.message||e).slice(0,400)},500)}});
