# CrowRules Podcasting Recovery Upgrade Parity

This repository is the operational UI surface for the CrowRules Podcasting recovery platform.

## Recovery lineage

- V7.63–V7.87 — session resilience, operation control, incident response, forensics, custody, compliance, monitoring, remediation, certification, notification routing, Trust Center
- V7.88 — trust baseline and drift detection
- V7.89 — trust drift alert/remediation response
- V7.90 — trust recovery closure
- V7.91 — evidence chain
- V7.92 — evidence export
- V7.93 — export verification
- V7.94 — chain dashboard
- V7.95 — command center
- V7.96 — live recovery
- V7.97 — automation planning
- V7.98 — approval/execution controls
- V7.99 — automated reverification
- V8.00 — orchestrator
- V8.01 — watchdog
- V8.02 — execution engine
- V8.03 — retry/circuit breaker
- V8.04 — incident command
- V8.05 — forensic captures
- V8.06 — timeline/evidence explorer
- V8.07 — operator actions
- V8.08 — controlled action executor
- V8.09 — workflow bridge
- V8.10 — state gate
- V8.11 — concurrency guard
- V8.12 — autonomous worker
- V8.13 — playbook execution center
- V8.14 — verified dispatcher
- V8.15 — autonomous loop
- V8.16 — verification/evidence closure
- V8.17 — true closed-loop recovery
- V8.18 — state synchronization
- V8.19 — state enforcement/self-healing decision layer
- V8.20 — Control Room 2.0
- V8.21 — telemetry and historical analytics
- V8.22 — analytics Control Room
- V8.23 — predictive recovery intelligence

## Repository parity

The admin directory contains the recovery UI modules carried forward from the original CrowRules Control Room, including the V7.88–V8.16 modules and the V8.20/V8.22/V8.23 UI layers.

The authoritative recovery state, security functions, immutable evidence, RLS policies, scheduled workers, and recovery tables remain in the shared Supabase project. This repository does not duplicate service-role credentials or bypass the existing crowrules_is_admin() authorization boundary.

## Safety

Moving the UI into Podcasting does not create a second recovery backend. Both CrowRules Entertainment and Podcasting operate against the same Supabase recovery state so telemetry, evidence, state, and security decisions remain consistent.
