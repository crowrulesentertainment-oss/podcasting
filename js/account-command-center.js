(()=>{"use strict";
const CFG={url:"https://cevylpnoexugwgygvtgu.supabase.co",fallbackRefreshMs:120000,realtimeRetryMs:10000,loadDebounceMs:250};
let db=null,state={user:null,member:null,profile:null,stats:null,membership:null,creator:null,creatorRecord:null,stripe:null,entitlement:null,premium:false,notifications:0,status:{account:"signed_out",membership:"none",creator:"available",stripe:"not_connected",premium:"none",notifications:"clear",realtime:"offline"},updated_at:null};
let timer=null,channel=null,reloadTimer=null,started=false,authSub=null;

const emit=()=>{state.updated_at=new Date().toISOString();window.dispatchEvent(new CustomEvent("crowrules:account-state",{detail:structuredClone(state)}));};
const getClient=()=>window.supabaseClient||window.supabase?.createClient(window.CROWRULES_SUPABASE_URL||CFG.url,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY);
const derive=()=>{state.status.account=state.user?"active":"signed_out";state.status.membership=state.membership?.status||"none";state.status.creator=state.creator?"active":"available";state.status.stripe=!state.stripe?"not_connected":state.stripe.payouts_enabled?"payouts_ready":(state.stripe.requirements_currently_due?.length||state.stripe.requirements_due?.length)?"action_required":"setup";state.status.premium=state.premium?"active":"none";state.status.notifications=state.notifications>0?"unread":"clear";};
async function load(){if(!db||!state.user)return state;const uid=state.user.id;const q=await Promise.allSettled([
db.from("members").select("*").eq("user_id",uid).maybeSingle(),
db.from("podcast_member_profiles").select("*").eq("user_id",uid).maybeSingle(),
db.from("podcast_member_profile_stats").select("*").eq("user_id",uid).maybeSingle(),
db.from("membership_subscriptions").select("*,membership_plans:plan_id(*)").eq("user_id",uid).order("created_at",{ascending:false}).limit(1).maybeSingle(),
db.from("creator_profiles").select("*").eq("user_id",uid).maybeSingle(),
db.from("cr_podcast_stripe_accounts").select("*").eq("user_id",uid).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
db.from("cr_podcast_entitlements").select("*").eq("member_user_id",uid).eq("status","active").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
db.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("is_read",false)
]);const v=i=>q[i].status==="fulfilled"?q[i].value:null;state.member=v(0)?.data||null;state.profile=v(1)?.data||null;state.stats=v(2)?.data||null;state.membership=v(3)?.data||null;state.creator=v(4)?.data||null;state.stripe=v(5)?.data||null;state.entitlement=v(6)?.data||null;state.premium=!!state.entitlement;state.notifications=v(7)?.count||0;state.creatorRecord=null;if(state.member?.id){const cr=await db.from("creators").select("*").eq("member_id",state.member.id).eq("is_active",true).order("created_at",{ascending:true}).limit(1).maybeSingle();if(!cr.error)state.creatorRecord=cr.data||null}derive();emit();return state}
const scheduleLoad=()=>{clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>load().catch(()=>{}),CFG.loadDebounceMs)};
const stopRealtime=()=>{if(channel){try{db?.removeChannel(channel)}catch{}channel=null}clearTimeout(reloadTimer)};
const startRealtime=()=>{stopRealtime();if(!db||!state.user)return;const uid=state.user.id;state.status.realtime="connecting";emit();channel=db.channel("crowrules-account-"+uid);
["members","podcast_member_profiles","podcast_member_profile_stats","membership_subscriptions","creator_profiles","cr_podcast_stripe_accounts","cr_podcast_entitlements","podcast_notifications"].forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table,filter:"user_id=eq."+uid},scheduleLoad));
channel.subscribe(status=>{if(status==="SUBSCRIBED"){state.status.realtime="connected";emit()}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){state.status.realtime="disconnected";emit();setTimeout(()=>state.user&&startRealtime(),CFG.realtimeRetryMs)}})};
async function init(){if(started)return state;started=true;db=getClient();if(!db){emit();return null}const r=await db.auth.getUser();if(!r.data?.user){emit();return null}state.user=r.data.user;derive();emit();await load();startRealtime();authSub=db.auth.onAuthStateChange(async(ev,s)=>{stopRealtime();state.user=s?.user||null;if(!state.user){Object.assign(state,{member:null,profile:null,stats:null,membership:null,creator:null,creatorRecord:null,stripe:null,entitlement:null,premium:false,notifications:0});derive();state.status.realtime="offline";emit()}else{derive();emit();await load();startRealtime()}});timer=setInterval(()=>state.user&&load().catch(()=>{}),CFG.fallbackRefreshMs);return state}
window.CrowRulesAccount={getState:()=>structuredClone(state),refresh:load,realtime:()=>state.status.realtime,on:fn=>{const h=e=>fn(e.detail);window.addEventListener("crowrules:account-state",h);return()=>window.removeEventListener("crowrules:account-state",h)},destroy:()=>{clearInterval(timer);stopRealtime();try{authSub?.data?.subscription?.unsubscribe()}catch{}started=false}};
window.CrowRulesAccount.ready=init();
})();