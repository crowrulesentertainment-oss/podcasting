import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-worker-secret", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply(405,{error:"POST required"});
 const secret=Deno.env.get("DISTRIBUTION_WORKER_SECRET");
 if(!secret || req.headers.get("x-worker-secret")!==secret) return reply(401,{error:"Unauthorized worker"});
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) return reply(503,{error:"Worker configuration incomplete"});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const now=new Date().toISOString();
 const {data:jobs,error}=await db.from("podcast_distribution_posts").select("id,user_id,podcast_id,episode_id,platform,caption,attempt_count").eq("status","queued").lte("scheduled_at",now).or("next_attempt_at.is.null,next_attempt_at.lte."+now).order("scheduled_at",{ascending:true}).limit(20);
 if(error) return reply(500,{error:"Could not read queue"});
 const results=[];
 for(const job of jobs||[]){
  const attempt=(job.attempt_count||0)+1;
  const {error:updateError}=await db.from("podcast_distribution_posts").update({status:"manual_required",attempt_count:attempt,locked_at:null,worker_id:null,last_error:"No verified direct-publishing adapter is configured for "+job.platform+". Use the manual publishing checklist; no post was sent.",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","queued");
  if(updateError){results.push({id:job.id,status:"retry_pending"});continue}
  await db.from("podcast_distribution_delivery_logs").insert({post_id:job.id,user_id:job.user_id,platform:job.platform,event_type:"manual_required",outcome:"warning",message:"Queue worker safely diverted this job to manual publishing because no verified platform adapter is configured."});
  results.push({id:job.id,status:"manual_required"});
 }
 return reply(200,{processed:results.length,results,note:"Worker never reports external delivery without a verified provider response."});
});