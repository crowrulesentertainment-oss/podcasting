import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const headers={"Access-Control-Allow-Origin":"https://crowrulesentertainment-oss.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
function fromHex(hex:string){if(!/^[a-fA-F0-9]{64}$/.test(hex))throw new Error("Invalid encryption key.");return Uint8Array.from(hex.match(/.{2}/g)!,b=>parseInt(b,16))}
function fromB64Url(value:string){const s=value.replace(/-/g,"+").replace(/_/g,"/");const b=atob(s+"=".repeat((4-s.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function decrypt(value:string){const parts=value.split(".");if(parts.length!==2)throw new Error("Encrypted session format is invalid.");const key=await crypto.subtle.importKey("raw",fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")||""),"AES-GCM",false,["decrypt"]);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64Url(parts[0])},key,fromB64Url(parts[1]));return new TextDecoder().decode(plain)}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json(405,{error:"POST required."});
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||"";
 if(!url||!anon||!serviceKey||!Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY"))return json(503,{error:"Recovery is not configured."});
 const authorization=req.headers.get("Authorization");if(!authorization)return json(401,{error:"Sign in required."});
 const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json(401,{error:"Session expired. Sign in again."});
 let body:Record<string,unknown>;try{body=await req.json()}catch{return json(400,{error:"Invalid JSON."})}
 const historyId=String(body.history_id||"");if(!/^[0-9a-f-]{36}$/i.test(historyId))return json(400,{error:"Valid upload history ID required."});
 const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:row,error}=await service.from("youtube_upload_history").select("id,user_id,podcast_id,status,upload_session_ciphertext,upload_session_expires_at,video_id,file_sha256,file_size,mime_type,filename").eq("id",historyId).eq("user_id",user.id).maybeSingle();
 if(error||!row)return json(404,{error:"Upload attempt not found for this account."});
 if(row.video_id)return json(200,{ok:true,complete:true,video_id:row.video_id,studio_url:row.studio_url||("https://studio.youtube.com/video/"+encodeURIComponent(row.video_id)+"/edit"),message:"A video ID is already saved for this attempt. Check its status; do not upload it again."});
 if(!row.upload_session_ciphertext)return json(409,{error:"No recoverable resumable session was saved for this attempt. Check YouTube Studio before retrying."});
 if(!row.upload_session_expires_at||new Date(row.upload_session_expires_at).getTime()<=Date.now())return json(410,{error:"The resumable session has expired. Check YouTube Studio for an existing video before starting another upload."});
 try{return json(200,{ok:true,history_id:row.id,upload_session:await decrypt(row.upload_session_ciphertext),file_sha256:row.file_sha256,file_size:row.file_size,mime_type:row.mime_type,filename:row.filename,podcast_id:row.podcast_id,expires_at:row.upload_session_expires_at})}
 catch{return json(500,{error:"Could not decrypt the saved session. Do not retry blindly; check YouTube Studio."})}
});