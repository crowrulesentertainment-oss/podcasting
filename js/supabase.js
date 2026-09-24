export const SUPABASE_URL=window.CROWRULES_CONFIG?.SUPABASE_URL||"https://cevylpnoexugwgygvtgu.supabase.co";
export const SUPABASE_ANON_KEY=window.CROWRULES_CONFIG?.SUPABASE_ANON_KEY||"sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
export const STRIPE_PUBLISHABLE_KEY=window.CROWRULES_CONFIG?.STRIPE_PUBLISHABLE_KEY||"";
export const isConfigured=Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);
export async function getSupabase(){
  if(!isConfigured)return null;
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.57.4");
  return createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
