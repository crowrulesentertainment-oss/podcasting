// CrowRules Podcasting — Stripe Connect creator onboarding
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-07-29.dahlia",
  httpClient: Stripe.createFetchHttpClient()
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") return json({ error: "POST required" }, 405);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Authentication required" }, 401);

    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json().catch(() => ({}));
    const podcastId = body.podcast_id ? String(body.podcast_id) : null;
    const origin = String(body.origin || "https://crowrulesentertainment-oss.github.io").replace(/\/$/, "");
    const returnPath = String(body.return_path || "/podcasting/payout-center.html");

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return json({ error: "MEMBERSHIP_PROFILE_REQUIRED" }, 403);

    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("id,name,member_id")
      .eq("member_id", member.id)
      .eq("is_active", true)
      .maybeSingle();
    if (creatorError) throw creatorError;
    if (!creator) return json({ error: "CREATOR_PROFILE_REQUIRED" }, 403);

    if (podcastId) {
      const { data: podcast, error: podcastError } = await supabase
        .from("podcasts")
        .select("id,creator_id")
        .eq("id", podcastId)
        .eq("creator_id", creator.id)
        .maybeSingle();
      if (podcastError) throw podcastError;
      if (!podcast) return json({ error: "PODCAST_NOT_OWNED" }, 403);
    }

    const { data: existing, error: existingError } = await supabase
      .from("cr_podcast_stripe_accounts")
      .select("*")
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (existingError) throw existingError;

    let stripeAccountId = existing?.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || undefined,
        capabilities: {
          transfers: { requested: true }
        },
        business_profile: {
          name: creator.name || "CrowRules Podcast Creator"
        },
        metadata: {
          creator_id: creator.id,
          user_id: user.id
        }
      });

      stripeAccountId = account.id;

      const { error: insertError } = await supabase
        .from("cr_podcast_stripe_accounts")
        .insert({
          creator_id: creator.id,
          user_id: user.id,
          stripe_account_id: account.id,
          account_type: "express",
          onboarding_status: "pending",
          country: account.country,
          default_currency: account.default_currency
        });
      if (insertError) throw insertError;
    }

    const refreshUrl = origin + returnPath +
      (returnPath.includes("?") ? "&" : "?") + "stripe_refresh=1";
    const returnUrl = origin + returnPath +
      (returnPath.includes("?") ? "&" : "?") + "stripe_return=1";

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });

    return json({
      onboarding_url: link.url,
      stripe_account_id: stripeAccountId,
      creator_id: creator.id,
      podcast_id: podcastId,
      status: existing?.onboarding_status || "pending"
    });
  } catch (error) {
    console.error("creator-connect-onboarding:", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to start Stripe onboarding."
    }, 400);
  }
});
