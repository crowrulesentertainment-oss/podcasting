import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const headers = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "POST required" });

  const expected = Deno.env.get("DISTRIBUTION_WORKER_SECRET");
  if (!expected || req.headers.get("x-worker-secret") !== expected) {
    return reply(401, { error: "Unauthorized worker" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503, { error: "Worker configuration incomplete" });

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const workerId = crypto.randomUUID();
  const { data: jobs, error } = await db.rpc("distribution_claim_jobs", {
    p_worker_id: workerId,
    p_limit: 20,
    p_lease_seconds: 300,
  });
  if (error) return reply(500, { error: "Could not claim distribution queue", detail: error.message });

  const results: Array<{ id: string; status: string }> = [];
  for (const job of jobs ?? []) {
    try {
      await db.from("podcast_distribution_delivery_logs").insert({
        post_id: job.id,
        user_id: job.user_id,
        platform: job.platform,
        event_type: "attempt_started",
        outcome: "info",
        message: "Worker claimed the scheduled job. Checking provider adapter availability.",
      });

      // Deliberately fail closed until that platform has an approved, tested publisher adapter.
      // Never label a job published unless the provider returns a verified post ID/URL.
      const outcome = await db.rpc("distribution_retry_or_fail", {
        p_post_id: job.id,
        p_worker_id: workerId,
        p_error: `No verified direct-publishing adapter is configured for ${job.platform}. No post was sent; manual publishing is required.`,
        p_provider_code: "adapter_not_configured",
        p_retryable: false,
      });
      if (outcome.error) {
        results.push({ id: job.id, status: "leased_needs_review" });
      } else {
        results.push({ id: job.id, status: String(outcome.data ?? "manual_required") });
      }
    } catch {
      // If the worker itself fails, leave the lease for timeout recovery rather than
      // falsely claiming success. A later worker can reclaim the expired lease.
      results.push({ id: job.id, status: "leased_needs_review" });
    }
  }

  return reply(200, {
    worker_id: workerId,
    claimed: (jobs ?? []).length,
    results,
    note: "No external post is reported as published without a verified provider response.",
  });
});
