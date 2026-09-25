import {getSupabase} from "./supabase.js";

const MAX_BYTES={artwork:10*1024*1024,thumbnail:10*1024*1024,audio:10*1024*1024*1024,video:10*1024*1024*1024,other:10*1024*1024*1024};
const ALLOWED={artwork:["image/"],thumbnail:["image/"],audio:["audio/"],video:["video/"],other:["audio/","video/","image/"]};

function validMime(file,type){const rules=ALLOWED[type]||ALLOWED.other;return rules.some(prefix=>file.type.startsWith(prefix));}
function inspectMedia(file){
 return new Promise((resolve,reject)=>{
  if(file.type.startsWith("image/")){const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve({width:img.naturalWidth,height:img.naturalHeight});};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error("Image inspection failed"));};img.src=u;return;}
  if(file.type.startsWith("audio/")||file.type.startsWith("video/")){const u=URL.createObjectURL(file),el=document.createElement(file.type.startsWith("video/")?"video":"audio");el.preload="metadata";el.onloadedmetadata=()=>{const out={duration_seconds:Number.isFinite(el.duration)?Math.round(el.duration*1000)/1000:null};if(el.videoWidth){out.width=el.videoWidth;out.height=el.videoHeight;}URL.revokeObjectURL(u);resolve(out);};el.onerror=()=>{URL.revokeObjectURL(u);reject(new Error("Media metadata inspection failed"));};el.src=u;return;}
  resolve({});
 });
}
async function updateAsset(id,patch){const s=await getSupabase();const r=await s.from("cr_creator_media_assets_62").update(patch).eq("id",id).select().single();if(r.error)throw r.error;return r.data;}
async function makeThumbnail(projectId,asset,file,second=1){
 if(!file.type.startsWith("video/"))return null;
 const u=URL.createObjectURL(file),v=document.createElement("video");v.preload="metadata";v.muted=true;v.src=u;
 await new Promise((res,rej)=>{v.onloadedmetadata=()=>res();v.onerror=()=>rej(new Error("Video thumbnail metadata failed"));});
 v.currentTime=Math.min(second||1,Math.max(0,(v.duration||1)-0.1));
 await new Promise((res,rej)=>{v.onseeked=()=>res();v.onerror=()=>rej(new Error("Video thumbnail frame failed"));});
 const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);
 const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",.84));URL.revokeObjectURL(u);if(!blob)throw new Error("Thumbnail encoding failed");
 const s=await getSupabase(),path=asset.owner_id+"/"+projectId+"/"+(asset.episode_id||"library")+"/"+Date.now()+"-thumb.jpg";
 const up=await s.storage.from("cr-podcast-artwork").upload(path,blob,{contentType:"image/jpeg",cacheControl:"3600",upsert:false});if(up.error)throw up.error;
 await updateAsset(asset.id,{thumbnail_path:path});return path;
}
export async function uploadCreatorAsset(projectId,file,assetType="other",episodeId=null){
 const s=await getSupabase();if(!s)throw new Error("Supabase unavailable");const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("Sign in required");
 if(!file||!file.size)throw new Error("Choose a file");if(!validMime(file,assetType))throw new Error("Unsupported MIME type for "+assetType);if(file.size>(MAX_BYTES[assetType]||MAX_BYTES.other))throw new Error("File exceeds the allowed size");
 const ext=(file.name.split(".").pop()||"bin").toLowerCase(),path=user.id+"/"+projectId+"/"+(episodeId||"library")+"/"+Date.now()+"."+ext,bucket=assetType==="artwork"||assetType==="thumbnail"?"cr-podcast-artwork":"cr-podcast-media";
 const r=await s.from("cr_creator_media_assets_62").insert({owner_id:user.id,project_id:projectId,episode_id:episodeId,asset_type:assetType,bucket_id:bucket,storage_path:path,original_filename:file.name,mime_type:file.type,size_bytes:file.size,processing_status:"validating",processing_progress:10}).select().single();if(r.error)throw r.error;
 try{
  await updateAsset(r.data.id,{processing_status:"uploading",processing_progress:25});
  const u=await s.storage.from(bucket).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  if(u.error)throw u.error;
  await updateAsset(r.data.id,{processing_status:"inspecting",processing_progress:55});
  const meta=await inspectMedia(file);
  const ready={duration_seconds:meta.duration_seconds||null,width:meta.width||null,height:meta.height||null,media_metadata:meta,processing_status:"processing",processing_progress:75};
  let asset=await updateAsset(r.data.id,ready);
  if(file.type.startsWith("video/")){try{await makeThumbnail(projectId,asset,file,1);}catch(e){console.warn("thumbnail generation:",e);}}
  asset=await updateAsset(r.data.id,{processing_status:"ready",processing_progress:100});
  return asset;
 }catch(e){await updateAsset(r.data.id,{processing_status:"failed",processing_progress:0,processing_error:e.message||"Processing failed"});throw e;}
}
export async function convertRecordingToEpisode(projectId,file,fields={}){const s=await getSupabase();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("Sign in required");const ep=await s.from("cr_creator_episodes_61").insert({project_id:projectId,owner_id:user.id,title:fields.title||file.name,season_number:Number(fields.season)||1,episode_number:fields.episode?Number(fields.episode):null,description:fields.description||null,status:"draft"}).select().single();if(ep.error)throw ep.error;try{const asset=await uploadCreatorAsset(projectId,file,"video",ep.data.id);const linked=await s.from("cr_creator_episodes_61").update({primary_media_asset_id:asset.id}).eq("id",ep.data.id).eq("owner_id",user.id).select().single();if(linked.error)throw linked.error;return {episode:linked.data,asset};}catch(e){await s.from("cr_creator_episodes_61").delete().eq("id",ep.data.id).eq("owner_id",user.id);throw e;}}\nexport async function processCreatorAsset(asset){const s=await getSupabase();if(!s)throw new Error("Supabase unavailable");return updateAsset(asset.id,{processing_status:"ready",processing_progress:100,processing_error:null});}
export async function listCreatorAssets(projectId,episodeId=null){const s=await getSupabase();if(!s)return [];let q=s.from("cr_creator_media_assets_62").select("*").eq("project_id",projectId).order("created_at",{ascending:false});if(episodeId)q=q.eq("episode_id",episodeId);const r=await q;if(r.error)throw r.error;return r.data||[];}
export async function attachAssetToEpisode(assetId,episodeId){const s=await getSupabase();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("Sign in required");const r=await s.from("cr_creator_media_assets_62").update({episode_id:episodeId,attached_at:new Date().toISOString()}).eq("id",assetId).eq("owner_id",user.id).select().single();if(r.error)throw r.error;return r.data;}
export async function detachAssetFromEpisode(assetId){const s=await getSupabase();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("Sign in required");const r=await s.from("cr_creator_media_assets_62").update({episode_id:null,attached_at:null}).eq("id",assetId).eq("owner_id",user.id).select().single();if(r.error)throw r.error;return r.data;}
export async function creatorAssetUrl(asset){const s=await getSupabase();if(asset.bucket_id==="cr-podcast-artwork")return s.storage.from(asset.bucket_id).getPublicUrl(asset.storage_path).data.publicUrl;const r=await s.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path,3600);if(r.error)throw r.error;return r.data.signedUrl;}
export async function creatorThumbnailUrl(asset){if(!asset?.thumbnail_path)return null;const s=await getSupabase();return s.storage.from("cr-podcast-artwork").getPublicUrl(asset.thumbnail_path).data.publicUrl;}
