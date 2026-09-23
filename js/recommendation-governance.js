/* CrowRules Podcasting — Recommendation Production Release Engine 12.0 */
(function(){
"use strict";
const db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const api={
 db,user:null,admin:false,
 async init(){
  const {data:{user}}=await db.auth.getUser(); this.user=user;
  if(!user)return this;
  const {data}=await db.from("crplus_admins").select("user_id,role,is_active").eq("user_id",user.id).eq("is_active",true).limit(1);
  this.admin=!!data?.length; return this;
 },
 async createRelease(experimentId,modelVersion,config,minSampleSize,outcomeWindowDays){if(!this.admin)throw new Error("administrator authorization required");const {data,error}=await db.rpc("podcast_recommendation_create_release",{p_experiment_id:experimentId,p_model_version:modelVersion,p_config:config,p_min_sample_size:minSampleSize,p_outcome_window_days:outcomeWindowDays});if(error)throw error;return data},
 async releases(){if(!this.admin)return [];const {data,error}=await db.from("podcast_recommendation_releases").select("*").order("created_at",{ascending:false});if(error)throw error;return data||[]},
 async active(){const {data,error}=await db.from("podcast_recommendation_active_release").select("*").maybeSingle();if(error)throw error;return data||null},
 async audit(releaseId){if(!this.admin)return [];const {data,error}=await db.from("podcast_recommendation_release_audit").select("release_id,action,from_status,to_status,metadata,created_at").eq("release_id",releaseId).order("created_at",{ascending:false});if(error)throw error;return data||[]},
 async promote(releaseId){if(!this.admin)throw new Error("administrator authorization required");const {data,error}=await db.rpc("podcast_recommendation_release_action",{p_release_id:releaseId,p_action:"promote"});if(error)throw error;return data},
 async rollback(releaseId){if(!this.admin)throw new Error("administrator authorization required");const {data,error}=await db.rpc("podcast_recommendation_release_action",{p_release_id:releaseId,p_action:"rollback"});if(error)throw error;return data}
};
window.CrowRulesRecommendationGovernance=api;
})();