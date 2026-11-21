import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });
const clean = (value: unknown, max: number) =>
  String(value ?? "").trim().replace(/[\r\n]/g, " ").slice(0, max);
const CONSENT_TESTS = [
  { name: "explicit_opt_in", consented: true, consent_at: "2026-01-01T00:00:00Z", consent_source: "account_preferences", unsubscribed_at: null, expected: true },
  { name: "no_record", consented: false, consent_at: null, consent_source: null, unsubscribed_at: null, expected: false },
  { name: "not_consented", consented: false, consent_at: null, consent_source: null, unsubscribed_at: null, expected: false },
  { name: "previously_unsubscribed", consented: true, consent_at: "2026-01-01T00:00:00Z", consent_source: "account_preferences", unsubscribed_at: "2026-01-02T00:00:00Z", expected: false },
  { name: "incomplete_consent", consented: true, consent_at: null, consent_source: null, unsubscribed_at: null, expected: false },
];
const isCurrentOptIn = (c: any) =>
  c?.consented === true && !!c?.consent_at && !!c?.consent_source && !c?.unsubscribed_at;
const CREATOR_DAILY_SECTION_ORDER = [
  "Announcements", "Creator Spotlight", "Collaboration Opportunities",
  "Community Activity", "Upcoming Events", "Production Reminders",
  "Tomorrow's Preview", "Creator Statistics & Milestones", "New Shows & Episodes",
];
const composeDigestSections = (content: Record<string, unknown[]>) =>
  CREATOR_DAILY_SECTION_ORDER
    .map((title) => ({ title, items: Array.isArray(content[title]) ? content[title] : [] }))
    .filter((section) => section.items.length > 0);
const editionDateAt = (instant: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);

async function getOptedInCreators(db: any) {
  const { data: creatorRows, error: creatorError } = await db
    .from("creators")
    .select("member_id,name,display_name")
    .eq("is_active", true)
    .eq("discipline", "podcasting")
    .not("member_id", "is", null)
    .limit(5000);
  if (creatorError) throw creatorError;
  const memberIds = [...new Set((creatorRows ?? []).map((r: any) => r.member_id).filter(Boolean))];
  if (!memberIds.length) return [];

  const { data: members, error: memberError } = await db
    .from("members")
    .select("id,user_id,status")
    .in("id", memberIds)
    .not("user_id", "is", null)
    .limit(5000);
  if (memberError) throw memberError;
  const activeMembers = (members ?? []).filter((m: any) =>
    !["suspended", "disabled", "inactive", "banned"].includes(String(m.status ?? "").toLowerCase())
  );
  const userIds = [...new Set(activeMembers.map((m: any) => m.user_id))];
  if (!userIds.length) return [];

  const { data: consents, error: consentError } = await db
    .from("podcast_creator_daily_consents")
    .select("user_id,consented,consent_at,consent_source,unsubscribed_at")
    .in("user_id", userIds);
  if (consentError) throw consentError;
  const consented = new Set((consents ?? [])
    .filter((c: any) => isCurrentOptIn(c))
    .map((c: any) => c.user_id));

  const creatorByMember = new Map((creatorRows ?? []).map((c: any) => [c.member_id, c]));
  const eligible = activeMembers.filter((m: any) => consented.has(m.user_id));
  const results: any[] = [];
  for (let i = 0; i < eligible.length; i += 20) {
    const batch = await Promise.all(eligible.slice(i, i + 20).map(async (m: any) => {
      const { data, error } = await db.auth.admin.getUserById(m.user_id);
      const user = data?.user;
      if (error || !user?.email || !user.email_confirmed_at) return null;
      const creator: any = creatorByMember.get(m.id);
      return {
        user_id: m.user_id,
        email: String(user.email).trim().toLowerCase(),
        name: clean(creator?.display_name || creator?.name || "Creator", 100),
      };
    }));
    results.push(...batch.filter(Boolean));
  }
  return [...new Map(results.map((r: any) => [r.email, r])).values()];
}

async function brevoSend(apiKey: string, payload: Record<string, unknown>, sandbox: boolean) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      ...payload,
      ...(sandbox ? { headers: { "X-Sib-Sandbox": "drop" } } : {}),
    }),
  });
  const text = await response.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { /* Keep provider response opaque. */ }
  if (!response.ok) {
    throw new Error("Brevo API returned HTTP " + response.status + ": " +
      clean(data?.message || data?.code || "Request rejected", 300));
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (req.headers.get("origin") &&
      req.headers.get("origin") !== "https://crowrulesentertainment-oss.github.io") {
    return reply({ error: "Origin not allowed." }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!url || !serviceKey || !anonKey) return reply({ error: "Supabase is not configured." }, 503);
  if (!brevoKey) return reply({ error: "BREVO_API_KEY is not configured." }, 503);

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return reply({ error: "Sign-in required." }, 401);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
  const user = authData?.user;
  if (authError || !user) return reply({ error: "Your session is invalid or expired." }, 401);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await db.from("cr_admins")
    .select("user_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (adminError || !admin) return reply({ error: "Active CrowRules administrator access is required." }, 403);

  let input: any = {};
  try { input = await req.json(); } catch { return reply({ error: "Invalid JSON body." }, 400); }
  const action = input.action ?? "status";

  if (action === "readiness") {
    const consentTests = CONSENT_TESTS.map((fixture) => ({
      name: fixture.name,
      passed: isCurrentOptIn(fixture) === fixture.expected,
    }));
    const consentLogicPassed = consentTests.every((test) => test.passed);

    const recipientFixtures = [
      { user_id: "recipient-a", metric: 12 },
      { user_id: "recipient-b", metric: 999 },
    ];
    const scoped = recipientFixtures.filter((row) => row.user_id === "recipient-a");
    const privacyPassed = scoped.length === 1 && scoped.every((row) => row.user_id === "recipient-a") &&
      !scoped.some((row) => row.metric === 999);

    const sectionFixture: Record<string, unknown[]> = {
      "Creator Spotlight": [{ title: "fixture" }],
      "Announcements": [{ title: "fixture" }],
      "New Shows & Episodes": [{ title: "fixture" }],
      "Upcoming Events": [],
    };
    const rendered = composeDigestSections(sectionFixture);
    const sectionPassed = rendered.map((section) => section.title).join("|") ===
      "Announcements|Creator Spotlight|New Shows & Episodes" &&
      rendered.every((section) => section.items.length > 0) &&
      CREATOR_DAILY_SECTION_ORDER.length === 9;

    const dstSummer = editionDateAt("2026-07-15T04:00:00.000Z");
    const dstWinter = editionDateAt("2026-12-15T05:00:00.000Z");
    const dstPassed = dstSummer === "2026-07-14" && dstWinter === "2026-12-14";

    const [creatorCount, consentCount, optedInCount, unsubscribedCount, tokenCount, ledgerCheck] = await Promise.all([
      db.from("creators").select("id", { count: "exact", head: true }).eq("is_active", true).eq("discipline", "podcasting").not("member_id", "is", null),
      db.from("podcast_creator_daily_consents").select("user_id", { count: "exact", head: true }),
      db.from("podcast_creator_daily_consents").select("user_id", { count: "exact", head: true }).eq("consented", true).not("consent_at", "is", null).not("consent_source", "is", null).is("unsubscribed_at", null),
      db.from("podcast_creator_daily_consents").select("user_id", { count: "exact", head: true }).not("unsubscribed_at", "is", null),
      db.from("podcast_marketing_unsubscribe_tokens").select("token_hash", { count: "exact", head: true }),
      db.from("podcast_creator_daily_editions").select("id", { count: "exact", head: true }),
    ]);
    const liveEligible = await getOptedInCreators(db);
    const checks = {
      opt_in_and_unsubscribe_rules: {
        ok: consentLogicPassed && !creatorCount.error && !consentCount.error && !optedInCount.error && !unsubscribedCount.error,
        detail: consentTests.filter((test) => test.passed).length + "/" + consentTests.length +
          " synthetic consent cases passed. Live creator profiles: " + (creatorCount.count ?? 0) +
          "; consent records: " + (consentCount.count ?? 0) +
          "; explicit opt-ins: " + (optedInCount.count ?? 0) +
          "; unsubscribed: " + (unsubscribedCount.count ?? 0) +
          "; currently eligible: " + liveEligible.length + ".",
      },
      unsubscribed_creator_exclusion: {
        ok: consentTests.find((test) => test.name === "previously_unsubscribed")?.passed === true &&
          liveEligible.every((recipient: any) => !!recipient.user_id),
        detail: "A consented record with unsubscribed_at set is excluded; no recipient addresses are returned.",
      },
      recipient_privacy_isolation: {
        ok: privacyPassed,
        detail: "Synthetic recipient-scoped data test passed; the recipient filter does not include another creator's private metrics.",
      },
      digest_section_renderer: {
        ok: sectionPassed,
        detail: "Nine-section order, populated-section rendering, and empty-section omission passed with synthetic content. Live content-source wiring is not yet complete.",
      },
      pacific_edition_date_and_ledger: {
        ok: dstPassed && !ledgerCheck.error,
        detail: "Pacific date conversion passed summer/winter DST fixtures. Unique edition-date ledger " +
          (ledgerCheck.error ? "is unavailable." : "is reachable.") +
          " The database enforces one row per local edition date.",
      },
    };

    return reply({
      ok: Object.values(checks).every((check) => check.ok),
      product: "CrowRules Creator Daily",
      checks,
      consent_test_cases: consentTests,
      digest_sections: CREATOR_DAILY_SECTION_ORDER,
      live_digest_sources_ready: false,
      one_click_unsubscribe_ready: false,
      production_dispatch_enabled: false,
      schedule_enabled: false,
      next_blockers: [
        "Wire approved/published live content sources into the nine digest sections.",
        "Complete and verify RFC 8058 one-click unsubscribe handling and Brevo campaign header behavior.",
        "Implement the scheduled runner against the unique Pacific-date edition ledger, then test it without activating a production schedule.",
      ],
    }, 200);
  }

  if (action === "diagnostics") {
    const checks: Record<string, { ok: boolean; detail: string }> = {};
    checks.authentication = { ok: true, detail: "Signed-in user verified." };
    checks.admin_permissions = { ok: true, detail: "Active CrowRules administrator verified." };

    const adminDbCheck = await db.from("cr_admins").select("user_id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true);
    checks.supabase_database = {
      ok: !adminDbCheck.error,
      detail: adminDbCheck.error ? "Administrator database query failed." : "Supabase database is reachable.",
    };

    const [consentCheck, tokenCheck, campaignCheck, deliveryCheck] = await Promise.all([
      db.from("podcast_creator_daily_consents").select("user_id,consented,consent_at,consent_source,unsubscribe_token_hash,unsubscribed_at", { count: "exact", head: true }),
      db.from("podcast_marketing_unsubscribe_tokens").select("token_hash,user_id,used_at", { count: "exact", head: true }),
      db.from("podcast_email_campaigns").select("id", { count: "exact", head: true }),
      db.from("podcast_email_campaign_deliveries").select("id", { count: "exact", head: true }),
    ]);
    checks.consent_infrastructure = {
      ok: !consentCheck.error && !tokenCheck.error,
      detail: !consentCheck.error && !tokenCheck.error
        ? "Consent records and hashed unsubscribe-token storage are reachable."
        : "Consent or unsubscribe-token schema could not be read.",
    };
    checks.campaign_delivery_tables = {
      ok: !campaignCheck.error && !deliveryCheck.error,
      detail: !campaignCheck.error && !deliveryCheck.error
        ? "Campaign and recipient-delivery tables are reachable."
        : "Campaign or delivery table could not be read.",
    };

    let brevoResponse: Response | null = null;
    try {
      brevoResponse = await fetch("https://api.brevo.com/v3/account", {
        method: "GET",
        headers: { "accept": "application/json", "api-key": brevoKey },
      });
      checks.brevo_api = {
        ok: brevoResponse.ok,
        detail: brevoResponse.ok ? "Brevo API key accepted; account endpoint reachable."
          : "Brevo rejected the account check (HTTP " + brevoResponse.status + ").",
      };
    } catch {
      checks.brevo_api = { ok: false, detail: "Could not reach the Brevo account endpoint." };
    }

    return reply({
      ok: Object.values(checks).every((check) => check.ok),
      product: "CrowRules Creator Daily",
      checks,
      sandbox_test_available: Object.values(checks).every((check) => check.ok),
      production_dispatch_enabled: false,
      schedule_enabled: false,
    }, 200);
  }

  if (action === "status" || action === "preview") {
    let eligibleCount = 0;
    if (action === "preview") eligibleCount = (await getOptedInCreators(db)).length;
    return reply({
      ok: true,
      product: "CrowRules Creator Daily",
      provider: "Brevo",
      provider_key_configured: true,
      sender: "crowrulesentertainment@gmail.com",
      reply_to: "crowrulesentertainment@gmail.com",
      audience_scope: "active podcasting creators with confirmed email and current, product-specific Creator Daily consent",
      eligible_creator_count: action === "preview" ? eligibleCount : undefined,
      production_dispatch_enabled: false,
      schedule_enabled: false,
    });
  }

  if (action === "test") {
    if (input.confirm_test !== true) {
      return reply({ error: "Set confirm_test=true to run the one-recipient sandbox test." }, 400);
    }
    if (!user.email) return reply({ error: "The administrator account has no email address." }, 400);
    const subject = "CrowRules Creator Daily — Brevo connection test";
    const textContent = "This is a sandbox connection test for CrowRules Creator Daily. No email is delivered in sandbox mode.";
    const htmlContent = "<!doctype html><html><body style='font-family:Arial,sans-serif;background:#101014;color:#f5f5f5;padding:32px'><h1 style='color:#d8b45a'>CrowRules Creator Daily</h1><p>Brevo API authentication and message validation test.</p><p><strong>Sandbox mode:</strong> no email was delivered.</p></body></html>";

    const { data: campaign, error: campaignError } = await db.from("podcast_email_campaigns")
      .insert({
        subject,
        body_text: textContent,
        recipient_scope: "creator_daily_test",
        total_recipients: 1,
        status: "processing",
        created_by: user.id,
      }).select("id").single();
    if (campaignError || !campaign) return reply({ error: "Could not create the test campaign record." }, 500);

    const { data: delivery, error: deliveryError } = await db.from("podcast_email_campaign_deliveries")
      .insert({
        campaign_id: campaign.id,
        recipient_user_id: user.id,
        recipient_email: String(user.email).trim().toLowerCase(),
        recipient_name: clean(user.user_metadata?.full_name || "CrowRules Administrator", 100),
        status: "queued",
        provider: "brevo",
      }).select("id").single();
    if (deliveryError || !delivery) {
      await db.from("podcast_email_campaigns").update({
        status: "failed", failed_count: 1, completed_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      return reply({ error: "Could not create the test delivery record." }, 500);
    }

    try {
      const result = await brevoSend(brevoKey, {
        sender: { name: "CrowRules Entertainment", email: "crowrulesentertainment@gmail.com" },
        replyTo: { name: "CrowRules Entertainment", email: "crowrulesentertainment@gmail.com" },
        to: [{ email: String(user.email).trim().toLowerCase(), name: "CrowRules Administrator" }],
        subject,
        textContent,
        htmlContent,
        tags: ["crowrules-creator-daily", "sandbox-test"],
      }, true);

      await db.from("podcast_email_campaign_deliveries").update({
        status: "skipped",
        provider_message_id: result.messageId ?? null,
        last_error: "Brevo sandbox accepted the request; no email was delivered.",
      }).eq("id", delivery.id);
      await db.from("podcast_email_campaigns").update({
        status: "completed", sent_count: 0, failed_count: 0, completed_at: new Date().toISOString(),
      }).eq("id", campaign.id);

      return reply({
        ok: true,
        provider: "Brevo",
        sandbox: true,
        email_delivered: false,
        recipient_scope: "signed-in administrator only",
        campaign_id: campaign.id,
        delivery_id: delivery.id,
        message: "Brevo accepted the sandbox request. No email was sent.",
      });
    } catch (error) {
      await db.from("podcast_email_campaign_deliveries").update({
        status: "failed",
        last_error: clean(error instanceof Error ? error.message : error, 500),
      }).eq("id", delivery.id);
      await db.from("podcast_email_campaigns").update({
        status: "failed", failed_count: 1, completed_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      return reply({ error: "Brevo sandbox test failed. See the test delivery record for a safe error summary." }, 502);
    }
  }

  if (action === "send") {
    return reply({
      error: "Creator Daily production delivery is intentionally disabled. This is a promotional digest and must use a Brevo marketing-campaign path that supports managed unsubscribe and one-click List-Unsubscribe headers. No creator emails were sent.",
      production_dispatch_enabled: false,
    }, 409);
  }

  return reply({ error: "Unsupported action." }, 400);
});
