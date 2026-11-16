import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
function page(title:string,message:string,actionUrl?:string){
 const action=actionUrl?'<form method="POST" action="'+esc(actionUrl)+'"><button type="submit" style="border:0;border-radius:10px;padding:13px 18px;background:#d7a94e;color:#08090c;font-weight:700;cursor:pointer">Confirm unsubscribe</button></form>':"";
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+' · CrowRules Podcasting</title></head><body style="margin:0;background:#08090c;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:560px;margin:24px;padding:28px;border:1px solid #463b27;border-radius:18px;background:#151515"><p style="color:#d7a94e;letter-spacing:2px;font-size:12px;font-weight:700">CROWRULES PODCASTING</p><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+action+'<p><a style="color:#d7a94e" href="https://crowrulesentertainment-oss.github.io/podcasting/platform-reviews.html">Return to Platform Reviews</a></p></main></body></html>';
 return new Response(html,{status:200,headers:{...cors,"Content-Type":"text/html; charset=utf-8"}});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET"&&req.method!=="POST")return new Response("Method not allowed",{status:405,headers:{...cors,"Allow":"GET, POST, OPTIONS"}});
 const requestUrl=new URL(req.url),token=requestUrl.searchParams.get("token")||"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return page("Invalid unsubscribe link","This link is missing or invalid. You can change your notification preferences from Platform Reviews.");
 if(req.method==="GET")return page("Confirm roadmap email unsubscribe","If you want to stop receiving CrowRules development roadmap emails, confirm below. Opening this page alone will not change your preferences.",requestUrl.toString());
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return page("Temporarily unavailable","We could not process your request right now. Please try again later.");
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from("podcast_notification_preferences").update({roadmap_email_enabled:false,roadmap_email_unsubscribed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("roadmap_email_unsubscribe_token",token).select("user_id").maybeSingle();
  if(error){console.error("Roadmap unsubscribe failed",error.code,error.message);return page("Temporarily unavailable","We could not update your preferences. Please try again later.");}
  if(!data)return page("Link unavailable","This unsubscribe link may already have been used or may be invalid.");
  return page("You’re unsubscribed","Roadmap update emails are now turned off. Your CrowRules account and in-app notifications are unchanged.");
 }catch(error){console.error("Roadmap unsubscribe error",error instanceof Error?error.message:String(error));return page("Temporarily unavailable","We could not process your request. Please try again later.");}
});
