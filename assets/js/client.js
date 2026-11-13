import{createClient}from"https://esm.sh/@supabase/supabase-js@2";import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from"./config.js";
// Use Supabase's standard project-scoped key so Podcasting shares the same
// browser session as CrowRules Universal Admin and the other same-origin workspaces.
const SHARED_AUTH_KEY="sb-cevylpnoexugwgygvtgu-auth-token";
// Migrate an existing Podcasting-only session once, without overwriting an
// already-established shared session. Preserve a pending PKCE verifier too.
try{
 if(!localStorage.getItem(SHARED_AUTH_KEY)){
  const oldSession=localStorage.getItem("crowrules-podcasting-auth");
  if(oldSession)localStorage.setItem(SHARED_AUTH_KEY,oldSession);
 }
 const oldVerifier=localStorage.getItem("crowrules-podcasting-auth-code-verifier");
 if(oldVerifier&&!localStorage.getItem(SHARED_AUTH_KEY+"-code-verifier"))localStorage.setItem(SHARED_AUTH_KEY+"-code-verifier",oldVerifier);
}catch(error){console.warn("Podcasting shared-session migration skipped:",error)}
export const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{persistSession:true,storage:window.localStorage,storageKey:SHARED_AUTH_KEY,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
});
