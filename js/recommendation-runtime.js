/* CrowRules Podcasting — Recommendation Runtime 13.0 */
(function(){
"use strict";
const db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const FALLBACK={experiment_id:"recommendation_engine_9",model_version:"9.0.0",status:"fallback",source:"bundled_fallback",config:{exploration:{balanced:.30,exploration:.55}}};
const api={db,release:null,model:FALLBACK,source:"fallback",validated:false,
 async resolve(){
  try{
   const {data,error}=await db.from("podcast_recommendation_active_release").select("id,experiment_id,model_version,status,config,created_at,promoted_at").maybeSingle();
   if(error||!data||data.status!=="promoted")throw error||new Error("no promoted release");
   const {data:snap,error:se}=await db.from("podcast_recommendation_model_snapshots").select("id,release_id,model_version,snapshot_hash,state,created_at").eq("release_id",data.id).maybeSingle();
   if(se||!snap||snap.release_id!==data.id||snap.model_version!==data.model_version)throw se||new Error("invalid immutable snapshot");
   this.release=data;this.model={experiment_id:data.experiment_id,model_version:data.model_version,status:"promoted",source:"supabase_release",config:data.config||{},snapshot_hash:snap.snapshot_hash};this.source="supabase_release";this.validated=true;
  }catch(e){this.release=null;this.model=FALLBACK;this.source="fallback";this.validated=false;console.debug("recommendation runtime fallback",e)}
  window.CrowRulesRecommendationRuntime=this;return this;
 },
 context(extra={}){return {runtime_model_version:this.model.model_version,runtime_release_id:this.release?.id||null,runtime_source:this.source,...extra}},
};
window.CrowRulesRecommendationRuntime=api;
})();