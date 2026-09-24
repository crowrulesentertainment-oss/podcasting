// CrowRules Podcasting — Stripe Connect payout operations
// Payout scheduling is controlled by Stripe on the creator's connected account.
// This endpoint opens the secure Express account onboarding flow; it never collects bank details in CrowRules UI.
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {apiVersion:"2026-07-29.dahlia",httpClient:Stripe.createFetchHttpClient()});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST")return json({error:"POST required"},405);
    const auth=req.headers.get("Authorization"); if(!auth)return json({error:"Authentication required"},401);
    const token=auth.replace(/^Bearer\s+/i,"");
    const {data:{user},error:ue}=await supabase.auth.getUser(token); if(ue||!user)return json({error:"SESSION_INVALID"},401);
    const {data:member,error:me}=await supabase.from("members").select("id").eq("user_id",user.id).maybeSingle(); if(me)throw me;
    if(!member)return json({error:"MEMBERSHIP_PROFILE_REQUIRED"},403);
    const {data:creator,error:ce}=await supabase.from("creators").select("id").eq("member_id",member.id).eq("is_active",true).maybeSingle(); if(ce)throw ce;
    if(!creator)return json({error:"CREATOR_PROFILE_REQUIRED"},403);
    const {data:connection,error:ae}=await supabase.from("cr_podcast_stripe_accounts").select("stripe_account_id,payouts_enabled").eq("creator_id",creator.id).maybeSingle(); if(ae)throw ae;
    if(!connection)return json({error:"STRIPE_CONNECTION_REQUIRED"},409);
    const account=await stripe.accounts.retrieve(connection.stripe_account_id);
    const requirements=(account as any).requirements||{};
    if(!account.payouts_enabled){
      return json({error:"PAYOUTS_NOT_ENABLED",payouts_enabled:false,requirements_currently_due:requirements.currently_due||[]},409);
    }
    const link=await stripe.accountLinks.create({
      account:connection.stripe_account_id,
      refresh_url:"https://crowrulesentertainment-oss.github.io/podcasting/payout-center.html?stripe_refresh=1",
      return_url:"https://crowrulesentertainment-oss.github.io/podcasting/payout-center.html?stripe_return=1",
      type:"account_onboarding"
    });
    return json({onboarding_url:link.url,payouts_enabled:true});
  }catch(error){console.error("creator-payouts:",error);return json({error:error instanceof Error?error.message:"Unable to open payout settings."},400);}
});
