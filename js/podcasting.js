window.CROW_APP=window.CROW_APP||{};
Object.assign(window.CROW_APP,{
  init:async function(){
    if(window.__CROW_APP_INIT_PROMISE)return window.__CROW_APP_INIT_PROMISE;
    window.__CROW_APP_INIT_PROMISE=(async()=>{
      const c=window.CROW_CONFIG||{};
      if(!window.supabase||!c.supabaseUrl||!c.supabaseKey){
        window.__CROW_USER=null;
        window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user:null,supabase:null}}));
        return null;
      }
      const sb=window.CROW_SUPABASE||(window.CROW_SUPABASE=window.supabase.createClient(c.supabaseUrl,c.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
      const {data,error}=await sb.auth.getUser();
      const user=error?null:(data?.user||null);
      window.__CROW_USER=user;
      const n=document.getElementById("navUser");
      if(n)n.textContent=user?(user.user_metadata?.full_name||user.email||"Member"):"Guest";
      window.__CROW_AUTH_READY=true;
      window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user,supabase:sb}}));
      return user;
    })();
    return window.__CROW_APP_INIT_PROMISE;
  },
  query:async function(table,select="*",opts={}){
    const sb=window.CROW_SUPABASE;if(!sb)return{data:[],error:new Error("Supabase unavailable")};
    let q=sb.from(table).select(select);
    if(opts.eq)for(const [k,v] of Object.entries(opts.eq))q=q.eq(k,v);
    if(opts.ilike)for(const [k,v] of Object.entries(opts.ilike))q=q.ilike(k,v);
    if(opts.order)q=q.order(opts.order,{ascending:opts.ascending!==false});
    if(opts.limit)q=q.limit(opts.limit);
    return q;
  },
  checkout:async function(plan){
    const sb=window.CROW_SUPABASE;if(!sb)throw Error("Supabase is unavailable");
    const {data:{session}}=await sb.auth.getSession();if(!session)throw Error("Sign in first.");
    const r=await sb.functions.invoke(CROW_CONFIG.membershipCheckoutFunction,{body:{plan_key:plan,success_url:location.origin+location.pathname+"?checkout=success",cancel_url:location.href}});
    if(r.error)throw r.error;if(r.data?.url)location.href=r.data.url;
  },
  google:async function(){const r=await CROW_SUPABASE.auth.signInWithOAuth({provider:"google",options:{redirectTo:CROW_CONFIG.siteUrl+"account.html"}});if(r.error)throw r.error},
  signOut:async function(){await CROW_SUPABASE.auth.signOut();location.href="home.html"},
  saveProgress:async function(episodeId,position,duration){
    const user=window.__CROW_USER;if(!user||!duration)return;
    const percent=Math.min(100,Math.max(0,(position/duration)*100));
    await CROW_SUPABASE.from("podcast_episode_progress").upsert({user_id:user.id,episode_id:episodeId,position_seconds:Math.floor(position),duration_seconds:Math.floor(duration),percent_complete:percent,completed:percent>=95,last_played_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});
  },
  recordListen:async function(episodeId,seconds,completed=false){
    const user=window.__CROW_USER;if(!user||!seconds)return;
    return CROW_SUPABASE.from("podcast_listens").insert({user_id:user.id,episode_id:episodeId,seconds_listened:Math.floor(seconds),completed,session_key:crypto.randomUUID()});
  }
});
document.addEventListener("DOMContentLoaded",()=>window.CROW_APP.init());