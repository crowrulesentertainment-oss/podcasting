/* CrowRules Podcasting — Recommendation Model Governance 11.0 */
(function(){
"use strict";
const KEY="crowrules_recommendation_governance";
const DEFAULT={experiment_id:"recommendation_engine_9",model_version:"9.0.0",status:"draft",min_sample_size:100,outcome_window_days:30,created_at:new Date().toISOString(),immutable:true};
const api={
 state:null,
 load(){try{this.state=JSON.parse(localStorage.getItem(KEY)||"null")||DEFAULT}catch(e){this.state=DEFAULT}return this.state},
 canTransition(next){const s=this.state?.status;return ({draft:["running"],running:["paused","completed"],paused:["running","completed"],completed:[]}[s]||[]).includes(next)},
 transition(next){if(!this.state)this.load();if(!this.canTransition(next))throw new Error("Invalid governance transition: "+this.state.status+" → "+next);this.state={...this.state,status:next,updated_at:new Date().toISOString()};this.save("status_transition");return this.state},
 save(action){localStorage.setItem(KEY,JSON.stringify(this.state));const audit=JSON.parse(localStorage.getItem(KEY+"_audit")||"[]");audit.push({action,at:new Date().toISOString(),status:this.state.status,model_version:this.state.model_version});localStorage.setItem(KEY+"_audit",JSON.stringify(audit.slice(-100)))},
 promote(){if(this.state.status!=="completed")throw new Error("Only completed experiments can be promoted.");this.save("promotion");return true},
 rollback(){this.save("rollback");return true},
 audit(){return JSON.parse(localStorage.getItem(KEY+"_audit")||"[]")}
};
window.CrowRulesRecommendationGovernance=api;api.load();
})();