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
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") return json({ error: "POST required" }, 405);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const token = auth.slice(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json().catch(() => ({}));
    const podcastId = body.podcast_id ? String(body.podcast_id) : null;
    const origin = String(body.origin || "https://crowrulesentertainment-oss.github.io").replace(/\/$/, "");
    const returnPath = String(body.return_path || "/podcasting/payout-center.html");

    const { data: member, error: memberError } = await supabase
      .from("members").select("id").eq("user_id", user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member) return json({ error: "MEMBERSHIP_PROFILE_REQUIRED" }, 403);

    const { data: creator, error: creatorError } = await supabase
      .from("creators").select("id,name,member_id").eq("member_id", member.id).eq("is_active", true).maybeSingle();
    if (creatorError) throw creatorError;
    if (!creator) return json({ error: "CREATOR_PROFILE_REQUIRED" }, 403);

    if (podcastId) {
      const { data: podcast, error: podcastError } = await supabase
        .from("podcasts").select("id,creator_id").eq("id", podcastId).eq("creator_id", creator.id).maybeSingle();
      if (podcastError) throw podcastError;
      if (!podcast) return json({ error: "PODCAST_NOT_OWNED" }, 403);
    }

    const { data: legacy, error: legacyError } = await supabase
      .from("creator_monetization")
      .select("id,status,stripe_account_id,payouts_enabled,charges_enabled,currency")
      .eq("user_id", user.id)
      .maybeSingle();
    if (legacyError) throw legacyError;

    const { data: existing, error: existingError } = await supabase
      .from("cr_podcast_stripe_accounts").select("*").eq("creator_id", creator.id).maybeSingle();
    if (existingError) throw existingError;

    let stripeAccountId = existing?.stripe_account_id || legacy?.stripe_account_id || null;
    let account: any = null;

    if (!stripeAccountId) {
      account = await stripe.accounts.create({
        type: "express",
        email: user.email || undefined,
        capabilities: { transfers: { requested: true } },
        business_profile: { name: creator.name || "CrowRules Podcast Creator" },
        metadata: { creator_id: creator.id, user_id: user.id }
      });
      stripeAccountId = account.id;
    }

    if (!existing) {
      const { error } = await supabase.from("cr_podcast_stripe_accounts").upsert({
        creator_id: creator.id,
        user_id: user.id,
        stripe_account_id: stripeAccountId,
        account_type: "express",
        onboarding_status: "pending",
        country: account?.country || null,
        default_currency: account?.default_currency || legacy?.currency || "usd",
        updated_at: new Date().toISOString()
      }, { onConflict: "creator_id" });
      if (error) throw error;
    }

    // Preserve the existing creator payout center's source of truth.
    const { error: monetizationError } = await supabase.from("creator_monetization").upsert({
      user_id: user.id,
      status: legacy?.status === "active" ? "active" : "pending",
      stripe_account_id: stripeAccountId,
      payouts_enabled: legacy?.payouts_enabled || false,
      charges_enabled: legacy?.charges_enabled || false,
      currency: legacy?.currency || account?.default_currency || "usd",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (monetizationError) throw monetizationError;

    const refreshUrl = origin + returnPath + (returnPath.includes("?") ? "&" : "?") + "stripe_refresh=1";
    const returnUrl = origin + returnPath + (returnPath.includes("?") ? "&" : "?") + "stripe_return=1";

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });

    return json({
      ok: true,
      onboarding_url: link.url,
      stripe_account_id: stripeAccountId,
      creator_id: creator.id,
      podcast_id: podcastId
    });
  } catch (error) {
    console.error("creator-connect-onboarding:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to start Stripe onboarding." }, 400);
  }
});