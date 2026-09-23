/* CrowRules Podcasting — Recommendation Experiment Engine 9.0 */
(function(){
"use strict";
const db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const runtime=window.CrowRulesRecommendationRuntime;
const active=runtime?.model||{};
const rc=active.config?.exploration||{};
const CONFIG={experiment_id:active.experiment_id||"recommendation_engine_9",model_version:active.model_version||"9.0.0",variants:["balanced","exploration"],exploration:{balanced:Number(rc.balanced??.30),exploration:Number(rc.exploration??.55)}};
const api={
 db,user:null,variant:"control",cohort:"anonymous",assignment:null,
 hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)},
 async init(){
  const {data:{user}}=await db.auth.getUser();this.user=user;
  const key=user?.id||"anon:"+location.hostname;
  const bucket=this.hash(CONFIG.experiment_id+":"+key)%100;
  this.variant=user?(bucket<50?CONFIG.variants[0]:CONFIG.variants[1]):"control";
  this.cohort=user?"member":"anonymous";this.assignment={experiment_id:CONFIG.experiment_id,model_version:CONFIG.model_version,variant:this.variant,cohort:this.cohort};
  if(user) await this.track("recommendation_experiment_assignment",null,null,this.assignment);
  return this;
 },
 async track(event_name,content_id=null,content_type="podcast",extra={}){
  if(!this.user)return;
  try{await db.from("analytics_events").insert({user_id:this.user.id,event_name,property:"recommendation_experiment",content_id,content_type,metadata:{...this.assignment,...extra}})}catch(e){console.debug("experiment event skipped",e)}
 },
 explorationRate(){return CONFIG.exploration[this.variant]??.30},
 decorateScore(score,isFamiliar,index){const explore=this.explorationRate();if(this.variant==="exploration"&&!isFamiliar)score+=35*explore;else if(this.variant==="balanced"&&!isFamiliar)score+=18*explore;return score},
 label(){return this.variant==="exploration"?"Exploration mix":"Balanced mix"}
};
window.CrowRulesRecommendationExperiment=api;
})();