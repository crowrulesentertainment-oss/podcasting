import {getSupabase} from "./supabase.js";
export async function creatorBackend(){
 const supabase=await getSupabase();
 if(!supabase) return {supabase:null,user:null};
 const {data:{user}}=await supabase.auth.getUser();
 return {supabase,user};
}
export async function loadStudioProject(){
 const {supabase,user}=await creatorBackend(); if(!supabase||!user)return {supabase,user,project:null};
 let {data:project,error}=await supabase.from("cr_creator_projects_61").select("*").eq("owner_id",user.id).order("created_at",{ascending:true}).limit(1).maybeSingle();
 if(error)throw error;
 if(!project){const r=await supabase.from("cr_creator_projects_61").insert({owner_id:user.id,title:"My CrowRules Podcast",status:"active"}).select().single(); if(r.error)throw r.error; project=r.data;}
 return {supabase,user,project};
}
export async function saveStudioEpisode(projectId,fields){
 const {supabase,user}=await creatorBackend(); if(!supabase||!user)throw new Error("Sign in required");
 const row={project_id:projectId,owner_id:user.id,title:fields.title,season_number:Number(fields.season)||1,episode_number:fields.episode?Number(fields.episode):null,description:fields.description||null,artwork_url:fields.artwork||null,media_url:fields.mediaUrl||null,status:fields.status||"draft"};
 const {data,error}=await supabase.from("cr_creator_episodes_61").insert(row).select().single(); if(error)throw error;
 if(fields.transcript?.trim()){const t=await supabase.from("cr_creator_transcripts_61").insert({episode_id:data.id,owner_id:user.id,transcript_text:fields.transcript}).select().single();if(t.error)throw t.error;}
 return data;
}
export async function listStudioEpisodes(projectId){
 const {supabase}=await creatorBackend(); if(!supabase)return [];
 const {data,error}=await supabase.from("cr_creator_episodes_61").select("*").eq("project_id",projectId).order("created_at",{ascending:false}); if(error)throw error; return data||[];
}
export async function saveStudioSession(projectId,activeScene,status="draft"){
 const {supabase,user}=await creatorBackend(); if(!supabase||!user)throw new Error("Sign in required");
 const {data,error}=await supabase.from("cr_creator_sessions_61").insert({project_id:projectId,owner_id:user.id,active_scene:activeScene,status}).select().single();if(error)throw error;return data;
}
export async function saveGuest(projectId,guest){
 const {supabase,user}=await creatorBackend(); if(!supabase||!user)throw new Error("Sign in required");
 const {data,error}=await supabase.from("cr_creator_guests_61").insert({...guest,project_id:projectId,owner_id:user.id}).select().single();if(error)throw error;return data;
}
