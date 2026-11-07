import{createClient}from"https://esm.sh/@supabase/supabase-js@2";import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from"./config.js";// Stable browser-local storage keeps the same Supabase session across all pages.
// Supabase refreshes access tokens automatically; session expiry/revocation remains governed by project policy.
export const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{persistSession:true,storage:window.localStorage,storageKey:"crowrules-podcasting-auth",autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
});
