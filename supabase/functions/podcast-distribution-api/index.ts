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
  return reply(501,{status:"not_configured",platform,account_id:account.id,message:"OAuth is not enabled until the provider client ID, secret, redirect URI, scopes, callback and approved app configuration are implemented and set as Edge Function secrets. No credentials were collected and no account is connected."});
 }
 if(action==="create_youtube_draft"){
  const episodeId=String(body.episode_id||""),caption=String(body.caption||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(episodeId)||!caption||caption.length>5000)return reply(400,{error:"Choose an episode and enter a caption of 1–5,000 characters."});
  const {data:member}=await db.from("members").select("id").eq("user_id",user.id).maybeSingle();
  if(!member)return reply(403,{error:"CrowRules member profile required."});
  const {data:creators,error:ce}=await db.from("creators").select("id").eq("member_id",member.id);
  if(ce||!creators?.length)return reply(403,{error:"Creator profile required."});
  const {data:episode,error:ee}=await db.from("podcast_episodes").select("id,podcast_id,youtube_video_id,youtube_processing_status,youtube_upload_status,youtube_privacy_status,youtube_promotion_approved_at").eq("id",episodeId).maybeSingle();
  if(ee||!episode)return reply(404,{error:"Episode not found."});
  const {data:podcast}=await db.from("podcasts").select("id,creator_id").eq("id",episode.podcast_id).in("creator_id",creators.map((x:any)=>x.id)).maybeSingle();
  if(!podcast)return reply(403,{error:"This episode is not part of your creator account."});
  if(!episode.youtube_promotion_approved_at||!episode.youtube_video_id||episode.youtube_processing_status!=="succeeded"||!["uploaded","processed"].includes(episode.youtube_upload_status)||!["private","unlisted","public"].includes(episode.youtube_privacy_status))return reply(409,{error:"Episode is not eligible. Refresh YouTube status, verify playback, and approve promotion first."});
  const {data:post,error}=await db.from("podcast_distribution_posts").insert({user_id:user.id,podcast_id:episode.podcast_id,episode_id:episode.id,platform:"youtube",caption,status:"draft"}).select().single();
  if(error||!post)return reply(400,{error:"Could not save caption draft: "+(error?.message||"unknown error")});
  const log=await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:"youtube",event_type:"draft_saved",outcome:"success",message:"Eligible YouTube promotion caption drafted. Nothing published."});
  if(log.error)return reply(500,{error:"Draft saved, but audit logging failed."});
  return reply(200,{post,message:"YouTube caption saved as draft. Nothing was published."});
 }
 if(action==="save_youtube_caption"){
  const postId=String(body.post_id||""),caption=String(body.caption||"").trim();
  if(!postId||!caption||caption.length>5000)return reply(400,{error:"Post ID and caption of 1–5,000 characters required."});
  const {data:post,error:pe}=await db.from("podcast_distribution_posts").select("id,user_id,platform,status").eq("id",postId).eq("user_id",user.id).maybeSingle();
  if(pe||!post||post.platform!=="youtube")return reply(404,{error:"YouTube draft not found."});
  if(!["draft","failed","manual_required"].includes(post.status))return reply(409,{error:"This draft can no longer be edited."});
  const {data,error}=await db.from("podcast_distribution_posts").update({caption,updated_at:new Date().toISOString(),last_error:null}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error)return reply(400,{error:error.message});return reply(200,{post:data,message:"Caption saved. Nothing published."});
 }
 const postId=String(body.post_id||"");
 if(!postId) return reply(400,{error:"post_id required"});
 const {data:post,error:postError}=await db.from("podcast_distribution_posts").select("id,user_id,podcast_id,episode_id,platform,status,scheduled_at,caption").eq("id",postId).eq("user_id",user.id).maybeSingle();
 if(postError||!post) return reply(404,{error:"Distribution draft not found"});
 if(action==="approve"){
  if(post.platform==="youtube"){
   const {data:episode}=await db.from("podcast_episodes").select("id,podcast_id,youtube_video_id,youtube_processing_status,youtube_privacy_status,youtube_upload_status,youtube_promotion_approved_at").eq("id",post.episode_id).eq("podcast_id",post.podcast_id).maybeSingle();
   if(!episode||!episode.youtube_promotion_approved_at||!episode.youtube_video_id||episode.youtube_processing_status!=="succeeded"||!["uploaded","processed"].includes(episode.youtube_upload_status)||!["private","unlisted","public"].includes(episode.youtube_privacy_status))return reply(409,{error:"YouTube episode approval or status is missing. Refresh status and approve promotion first."});
  }
  if(!["draft","failed","manual_required"].includes(post.status)) return reply(409,{error:"This draft cannot be approved from its current state"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"approved",approved_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error) return reply(400,{error:error.message});
  const log=await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"approved",outcome:"success",message:"Creator approved draft. Not yet queued or published."});
  if(log.error) return reply(500,{error:"Draft approved, but audit log write failed."});
  return reply(200,{post:data,message:"Approved; not published."});
 }
 if(action==="queue"){
  if(post.platform==="youtube"){
   if(body.final_confirmation!==true)return reply(400,{error:"Explicit final confirmation is required."});
   if(post.status!=="approved")return reply(409,{error:"Approve the caption before final confirmation."});
   const {data:episode}=await db.from("podcast_episodes").select("id,youtube_video_id,youtube_processing_status,youtube_privacy_status,youtube_upload_status,youtube_promotion_approved_at").eq("id",post.episode_id).eq("podcast_id",post.podcast_id).maybeSingle();
   if(!episode||!episode.youtube_promotion_approved_at||!episode.youtube_video_id||episode.youtube_processing_status!=="succeeded"||!["uploaded","processed"].includes(episode.youtube_upload_status)||!["private","unlisted","public"].includes(episode.youtube_privacy_status))return reply(409,{error:"YouTube status or episode approval is no longer valid. Refresh and review again."});
   const {data,error}=await db.from("podcast_distribution_posts").update({status:"manual_required",scheduled_at:null,next_attempt_at:null,last_error:"Final review confirmed. Manual publishing only; no automated YouTube publisher is configured.",updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
   if(error)return reply(400,{error:error.message});
   const log=await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:"youtube",event_type:"queued",outcome:"info",message:"Creator explicitly confirmed final review. Marked manual-required; no external post was sent."});
   if(log.error)return reply(500,{error:"Final review saved, but audit logging failed."});
   return reply(200,{post:data,message:"Final review confirmed. Saved for manual publishing; no external publishing action was performed."});
  }
  if(post.status!=="approved") return reply(409,{error:"Approve the draft before queuing"});
  const scheduledAt=body.scheduled_at?new Date(body.scheduled_at):new Date();
  if(Number.isNaN(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()-60000) return reply(400,{error:"Choose a valid future schedule"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"queued",scheduled_at:scheduledAt.toISOString(),next_attempt_at:scheduledAt.toISOString(),attempt_count:0,idempotency_key:post.id+":"+scheduledAt.toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error) return reply(400,{error:error.message});
  const log=await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"queued",outcome:"info",message:"Approved draft queued for "+scheduledAt.toISOString()+". External publishing requires a verified provider adapter."});
  if(log.error) return reply(500,{error:"Job queued, but audit log write failed."});
  return reply(200,{post:data,message:"Queued; external delivery is not guaranteed until the platform adapter is configured."});
 }
 if(action==="cancel"){
  if(!["queued","approved","failed","manual_required"].includes(post.status)) return reply(409,{error:"This post cannot be cancelled now"});
  const {data,error}=await db.from("podcast_distribution_posts").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",post.id).eq("user_id",user.id).select().single();
  if(error)return reply(400,{error:error.message});
  const log=await db.from("podcast_distribution_delivery_logs").insert({post_id:post.id,user_id:user.id,platform:post.platform,event_type:"cancelled",outcome:"warning",message:"Creator cancelled distribution job."});
  if(log.error) return reply(500,{error:"Job cancelled, but audit log write failed."});
  return reply(200,{post:data});
 }
 return reply(400,{error:"Unknown action"});
});