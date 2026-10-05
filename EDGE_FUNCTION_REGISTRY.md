# Podcasting Edge Function Registry + CI Auditor

This registry protects the CrowRules Podcasting site from broken Supabase Edge Function references.

## What it does

- Scans every tracked .html and .js file.
- Detects supabase.functions.invoke(...) calls.
- Resolves CROW_CONFIG.* function names from js/config.js.
- Detects direct /functions/v1/<slug> URLs and template fallbacks.
- Compares referenced functions with the live Supabase Edge Function inventory.
- Flags missing, non-active, or explicitly deprecated functions.
- Reports functions that exist live but have not yet been added to this registry.

Supabase's Management API exposes the project Edge Function list at GET /v1/projects/{ref}/functions and requires the edge_functions_read permission. Keep the Management API token in GitHub Actions secrets; never put it in browser code.

## GitHub Actions

The workflow is .github/workflows/edge-function-audit.yml.

Required repository secret:

SUPABASE_ACCESS_TOKEN

Use a scoped Supabase token with Edge Functions Read permission.

## Local audit

Static-only:

    node scripts/audit-edge-functions.mjs

Live audit:

    SUPABASE_FUNCTIONS_JSON=./live-functions.json node scripts/audit-edge-functions.mjs

The auditor writes:

- artifacts/edge-function-audit.json
- artifacts/edge-function-audit.md
