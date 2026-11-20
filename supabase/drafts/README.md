# Community Groups Phase 1 SQL draft

This folder contains a reviewed draft for the first additive CrowRules Podcasting Community Groups database change.

## Important

- This is **not** a timestamped Supabase migration.
- It has **not** been applied to production.
- It has **not** changed Supabase migration history.
- It intentionally extends the existing `podcast_community_circles` model rather than creating duplicate `community_groups`, profile, or direct-message systems.
- Existing production RLS policies are retained; only new policies are added.
- Existing circle rows with `is_public = false` are backfilled as `hidden` to preserve their previous non-discoverable behavior.

## Migration-history reconciliation — audit findings

Read-only inspection of production project `cevylpnoexugwgygvtgu` found:

- Production migration ledger: **1,428** records.
- First recorded version: `20260907232724`.
- Latest recorded version: `20261120045815` (`podcasting_weekly_public_visitor_pulse`).
- All 1,428 ledger rows contain SQL in the `statements` array.
- The GitHub repository has no committed `supabase/config.toml` and no `supabase/migrations/` directory on the audited branch/main baseline.

This is recoverable without repairing or rewriting the production ledger: use the Supabase CLI migration-fetch command to reconstruct the local migration files from the recorded statements. Do **not** use `migration repair`, `db pull`, `db push`, or `supabase pull` as the first reconciliation step.

## Safe local reconciliation

Run these commands in PowerShell from the Podcasting repository root, on branch `feature/community-groups-phase1-foundation`. These commands fetch migration source files and compare history; they do not deploy the Community Groups SQL.

```powershell
git status --short
git switch feature/community-groups-phase1-foundation

# Create the local Supabase CLI config if this checkout does not have one.
# Do not use --force.
if (-not (Test-Path "supabase/config.toml")) {
  npx supabase init
}

# Check the installed CLI and its supported command flags.
npx supabase --version
npx supabase migration fetch --help

# Link this local checkout to the intended project, if it is not already linked.
npx supabase link --project-ref cevylpnoexugwgygvtgu

# Reconstruct migration files from the remote migration-history statements.
npx supabase migration fetch --remote

# Compare local migration files with the production ledger.
npx supabase migration list --remote

# Confirm the recovered file count and inspect the working tree.
(Get-ChildItem "supabase/migrations" -Filter "*.sql" -File).Count
git status --short
```

Expected reconciliation result: the local migration file set should include the 1,428 recorded versions, and `supabase migration list --remote` should show no missing local or remote versions. Inspect the output rather than assuming this result. If any files are absent, empty, or mismatched, stop and investigate; do not repair production history to force a match.

**Do not run `supabase pull` as a substitute for this step.** The current CLI documentation says that `supabase pull` also runs a schema pull that updates the remote project's migration-history table. Likewise, do not run `db pull`, `db push`, `migration repair`, or `migration up` against production during reconciliation.

## After reconciliation

1. Review the fetched migration files and confirm the local/remote history comparison is clean.
2. Start the local Supabase stack and run `npx supabase db reset` against the local database only. This is the first replay test; it must not target the linked production project.
3. Resolve any historical migration replay failures before proceeding.
4. Generate the official Community Groups migration with `npx supabase migration new community_groups_phase1` only after the historical chain is reproducible.
5. Copy the SQL draft into that CLI-generated timestamped file.
6. Test it locally and verify RLS with separate public, member, owner, moderator, and administrator identities.
7. Only after successful review and tests should production deployment be considered.

Supabase CLI v3 targets local databases by default, but commands can target hosted projects with `--remote`. Read the resolved target printed by the CLI before confirming any hosted operation.

## Phase 1 scope

- Extend existing circle records with slugs, cover/avatar URL fields, visibility, and group-chat enablement.
- Preserve compatibility with the legacy `is_public` column.
- Support discoverable private groups and invitation-only hidden groups.
- Add private-group join requests with atomic moderator approval.
- Add RLS-protected group chat messages and Realtime publication membership.
- Reuse existing circle posts/replies, events/RSVPs, invitations, polls/collaborations, activity, recognition, member profiles, and direct messaging.

Media bucket provisioning, front-end routes, group media uploads, voice provider integration, Watch Together, badge catalog expansion, analytics dashboards, and admin UI remain later implementation work.
