import{readFileSync}from"node:fs";
import{join}from"node:path";
const root=process.cwd();
const app=readFileSync(join(root,"assets/js/app.js"),"utf8");
const css=readFileSync(join(root,"assets/css/site.css"),"utf8");
const admin=readFileSync(join(root,"admin.html"),"utf8");
const geo=readFileSync(join(root,"supabase/functions/podcasting-live-visitor-geolocation/index.ts"),"utf8");
const geoMigration=readFileSync(join(root,"supabase/migrations/20261117130000_podcasting_live_visitor_city_region_geolocation.sql"),"utf8");
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
assert(admin.includes("20261117-city-region-visitor-map-v1"),"Admin HTML uses cache-busted app.js");
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

for(const token of ["adminVisitorMap","adminVisitorMapLeader","adminVisitorMapNote","adminActivityCitiesList","adminActivityRegionsList","renderVisitorMap(data,displayNames)"])assert(app.includes(token),"Live visitor map renders "+token);
for(const token of ["visitorCountryCenters","loadVisitorMapLibrary","L.tileLayer","L.circleMarker","MOST ACTIVE CITY","MOST ACTIVE STATE / REGION","MOST ACTIVE COUNTRY","Approximate country center","countryFallbacks","by_city","by_region"])assert(app.includes(token),"Visitor map supports "+token);
assert(app.includes("Heartbeat received within 90 seconds")&&app.includes("Browser language provides a country-only fallback"),"Visitor map preserves 90-second activity and locale-estimate privacy wording");
assert(app.includes("podcasting-live-visitor-geolocation")&&app.includes("21600000"),"Visitor geo lookup is server-side and throttled to six hours per browser session");
assert(app.includes("rounded to about 0.1°")&&app.includes("not GPS or street addresses"),"Visitor city map discloses approximate location precision and privacy limits");
assert(app.includes("admin-visitor-map-leaders")&&app.includes("adminActivityRegions"),"City, state/region and country leaders and rankings are rendered");
assert(geo.includes("ipwho.is/")&&geo.includes("podcasting_touch_live_presence_geo")&&geo.includes("SUPABASE_ANON_KEY"),"Server-side geolocation forwards only approximate fields through the authenticated RPC");
assert(!geo.includes("console.log(ip)")&&!geo.includes("console.error(ip)")&&!geo.includes("p_ip_address"),"Visitor IP is not logged or persisted by the edge function");
assert(geoMigration.includes("add column if not exists city")&&geoMigration.includes("add column if not exists region")&&geoMigration.includes("round(p_latitude,1)")&&geoMigration.includes("podcasting_admin_live_activity_impl"),"Database migration stores city/region and rounded coordinates for admin aggregates");
assert(app.includes("@media(max-width:760px)")&&app.includes("admin-visitor-map-frame #adminVisitorMap{height:330px}"),"Visitor map has a responsive mobile layout");

console.log("PASS: "+checks.length+" Admin Dashboard static regression checks.");
for(const item of checks)console.log("  ✓ "+item);
