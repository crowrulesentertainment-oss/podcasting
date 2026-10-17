import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
const platforms=["facebook","instagram","tiktok","youtube","x","threads","crowrules"];
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply(405,{error:"POST required"});
 const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), auth=req.headers.get("Authorization");
 if(!url||!anon||!auth) return reply(401,{error:"Sign in required"});
 const db=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await db.auth.getUser();
 if(userError||!user) return reply(401,{error:"Invalid session"});
 let body:any; try{body=await req.json()}catch{return reply(400,{error:"Invalid JSON"})}
 const action=String(body.action||"");
 if(action==="connection_status"){
  const {data,error}=await db.from("podcast_distribution_accounts").select("id,podcast_id,platform,account_label,profile_url,connection_status,connection_method,updated_at").eq("user_id",user.id);
  return error?reply(400,{error:error.message}):reply(200,{accounts:data||[]});
 }
 if(action==="start_connection"){
  const platform=String(body.platform||"");
  if(!platforms.includes(platform)||platform==="crowrules") return reply(400,{error:"Unsupported external platform"});
  const show=String(body.podcast_id||"");
  const {data:account,error:accountError}=await db.from("podcast_distribution_accounts").upsert({user_id:user.id,podcast_id:show,platform,connection_status:"not_connected",connection_method:"manual",updated_at:new Date().toISOString()},{onConflict:"user_id,podcast_id,platform"}).select("id").single();
  if(accountError||!account) return reply(400,{error:"Could not create connection record. Verify creator ownership and podcast ID."});
  return reply(501,{status:"not_configured",platform,account_id:account.id,message:"OAuth is not enabled until the provider client ID, secret, redirect URI, scopes, and approved app configuration are set as Supabase Edge Function secrets. No credentials were collected and no account is connected."});
 }
 const postId=String(body.post_id||"");
 if(!postId) return reply(400,{error:"post_id required"});
 const {data:post,error:postError}=await db.from("podcast_distribution_posts").select("id,user_id,podcast_id,platform,status,scheduled_at,caption").eq("id",postId).eq("user_id",user.id).maybeSingle();
 if(postError||!post) return reply(404,{error:"Distribution draft not found"});
 if(action==="approve"){
  if(!["draft","failed","manual_required"].includes(post.status)) return reply(409,{error:"This draft cannot be approved from its current state"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"approved",approved_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error) return reply(400,{error:error.message});
  await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"approved",outcome:"success",message:"Creator approved draft. Not yet queued or published."});
  return reply(200,{post:data,message:"Approved; not published."});
 }
 if(action==="queue"){
  if(post.status!=="approved") return reply(409,{error:"Approve the draft before queuing"});
  const scheduledAt=body.scheduled_at?new Date(body.scheduled_at):new Date();
  if(Number.isNaN(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()-60000) return reply(400,{error:"Choose a valid future schedule"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"queued",scheduled_at:scheduledAt.toISOString(),next_attempt_at:scheduledAt.toISOString(),attempt_count:0,idempotency_key:post.id+":"+scheduledAt.toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error) return reply(400,{error:error.message});
  await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"queued",outcome:"info",message:"Approved draft queued for "+scheduledAt.toISOString()+". External publishing requires a verified provider adapter."});
  return reply(200,{post:data,message:"Queued; external delivery is not guaranteed until the platform adapter is configured."});
 }
 if(action==="cancel"){
  if(!["queued","approved","failed","manual_required"].includes(post.status)) return reply(409,{error:"This post cannot be cancelled now"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error)return reply(400,{error:error.message});
  await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"cancelled",outcome:"warning",message:"Creator cancelled distribution job."});
  return reply(200,{post:data});
 }
 return reply(400,{error:"Unknown action"});
});