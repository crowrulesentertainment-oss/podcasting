// CrowRules Podcasting — Stripe Connect status
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-07-29.dahlia",
  httpClient: Stripe.createFetchHttpClient()
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST") return json({error:"POST required"},405);
    const auth=req.headers.get("Authorization");
    if(!auth) return json({error:"Authentication required"},401);
    const token=auth.replace(/^Bearer\s+/i,"");
    const {data:{user},error:ue}=await supabase.auth.getUser(token);
    if(ue||!user) return json({error:"SESSION_INVALID"},401);

    const {data:member,error:me}=await supabase.from("members").select("id").eq("user_id",user.id).maybeSingle();
    if(me) throw me;
    if(!member) return json({error:"MEMBERSHIP_PROFILE_REQUIRED"},403);

    const {data:creator,error:ce}=await supabase.from("creators").select("id,name").eq("member_id",member.id).eq("is_active",true).maybeSingle();
    if(ce) throw ce;
    if(!creator) return json({error:"CREATOR_PROFILE_REQUIRED"},403);

    const {data:connection,error:ae}=await supabase.from("cr_podcast_stripe_accounts").select("*").eq("creator_id",creator.id).maybeSingle();
    if(ae) throw ae;
    if(!connection) return json({connected:false,onboarding_status:"not_started",payouts_enabled:false,charges_enabled:false});

    const account=await stripe.accounts.retrieve(connection.stripe_account_id);
    const requirements=(account as any).requirements||{};
    const status=account.payouts_enabled?"enabled":account.details_submitted?"submitted":"pending";
    await supabase.from("cr_podcast_stripe_accounts").update({
      onboarding_status:status,
      charges_enabled:account.charges_enabled,
      payouts_enabled:account.payouts_enabled,
      details_submitted:account.details_submitted,
      country:account.country,
      default_currency:account.default_currency,
      requirements_due:requirements.eventually_due||[],
      requirements_currently_due:requirements.currently_due||[],
      disabled_reason:requirements.disabled_reason||null,
      updated_at:new Date().toISOString()
    }).eq("id",connection.id);

    return json({
      connected:true,
      stripe_account_id:account.id,
      onboarding_status:status,
      payouts_enabled:account.payouts_enabled,
      charges_enabled:account.charges_enabled,
      details_submitted:account.details_submitted,
      requirements_currently_due:requirements.currently_due||[]
    });
  }catch(error){
    console.error("creator-connect-status:",error);
    return json({error:error instanceof Error?error.message:"Unable to read Stripe status."},400);
  }
});
