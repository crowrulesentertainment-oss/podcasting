import{readFileSync}from"node:fs";
import{join}from"node:path";
const root=process.cwd();
const app=readFileSync(join(root,"assets/js/app.js"),"utf8");
const css=readFileSync(join(root,"assets/css/site.css"),"utf8");
const admin=readFileSync(join(root,"admin.html"),"utf8");
const checks=[];
function assert(ok,message){if(!ok)throw Error("Admin QA failed: "+message);checks.push(message)}
function moduleBlock(tab,nextTab){
 const start=app.indexOf('if(tab==="'+tab+'"){');
 const end=nextTab?app.indexOf('if(tab==="'+nextTab+'"){',start+1):app.indexOf('if(tab==="shows"){',start+1);
 assert(start>=0&&end>start,"Module "+tab+" is registered in the admin renderer");
 return app.slice(start,end);
}
const tabs=["platformFeedback","reviewAnalytics","healthMonitoring","automation14","developmentRoadmap"];
for(const tab of tabs)assert(app.includes('["'+tab+'",'),"Navigation includes "+tab);
assert(admin.includes("20261117-admin-workspace-fixes-v1"),"Admin HTML uses cache-busted app.js");
const feedback=moduleBlock("platformFeedback","reviewAnalytics");
for(const token of ["podcast_platform_feedback","podcast_platform_reviews","podcast_platform_review_reports","podcast_platform_feedback_monthly_reports","admin_generate_podcast_platform_feedback_report","data-save-platform-feedback","data-save-platform-review","data-platform-report-state","data-save-platform-reply","data-feedback-to-roadmap"])assert(feedback.includes(token),"Platform feedback supports "+token);
assert(feedback.includes(".catch(fail)")||feedback.includes("catch(error)"),"Platform feedback surfaces query and action failures");
assert(feedback.includes("Member idea: ")&&feedback.includes("Member request: "),"Short feedback is normalized to roadmap title/summary constraints");
const analytics=moduleBlock("reviewAnalytics","healthMonitoring");
for(const token of ["podcast_reviews","podcast_episode_reviews","podcast_platform_reviews","podcast_review_analytics_monthly_reports","crReviewAnalyticsGenerate","crReviewAnalyticsReload","upsert("])assert(analytics.includes(token),"Review analytics supports "+token);
assert(analytics.includes("catch(e=>status.textContent")||analytics.includes("catch(e=>status.textContent"),"Review analytics surfaces load/report failures");
const health=moduleBlock("healthMonitoring","automation14");
for(const token of ["podcast_health_incidents","podcast_media_uploads","podcast_media_processing_jobs","podcast_notification_delivery_queue","crHealthIncidentForm","crHealthRefresh","data-health-incident-save"])assert(health.includes(token),"Health monitoring supports "+token);
assert(health.includes("catch(e){fail(e)}"),"Health refresh surfaces failures");
const automation=moduleBlock("automation14","developmentRoadmap");
for(const token of ["podcast_admin_list_scheduled_automations_v14","podcast_automation_runs_v14","crAutoSearch","crAutoStatus","crAutoRefresh"])assert(automation.includes(token),"Automation center supports "+token);
assert(automation.includes("catch(e){fail(e)}"),"Automation refresh surfaces failures");
const roadmap=moduleBlock("developmentRoadmap","shows");
for(const token of ["podcast_development_roadmap","podcast_platform_feedback","crRoadmapCreate","data-cr-roadmap-edit","data-cr-roadmap-delete","crRoadmapReload"])assert(roadmap.includes(token),"Development roadmap supports "+token);
assert(roadmap.includes("work.innerHTML=")&&!roadmap.includes("content.innerHTML="),"Roadmap renders into the admin workspace");

assert(css.includes("@media(max-width:650px)")&&css.includes(".cr-review-mod-stats{grid-template-columns:repeat(2,minmax(0,1fr))}"),"Review/admin cards collapse to two columns on mobile");
assert(css.includes("@media(max-width:600px){.cr-review-form-grid{grid-template-columns:1fr}"),"Admin forms collapse to one column on small screens");
console.log("PASS: "+checks.length+" Admin Dashboard 14.1 static regression checks.");
for(const item of checks)console.log("  ✓ "+item);
