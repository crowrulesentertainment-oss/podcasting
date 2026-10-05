#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const PROTECTED = [
  "cr_podcast_population_evidence_v77",
  "cr_podcast_evidence_audit_v712",
  "cr_podcast_evidence_determinism_v717",
  "cr_podcast_evidence_replays_v715",
  "cr_podcast_evidence_provenance_v713",
  "cr_podcast_evidence_dataset_ledger_v716",
];

const GATE_PATTERNS = [
  /evidenceReleaseGate\s*\(/i,
  /cr_podcast_evidence_release_gate_v721/i,
  /get_evidence_release_v721/i,
];

const IGNORE = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  ".next",
  ".cache",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function scanFile(file) {
  const content = fs.readFileSync(file, "utf8");
  const matched = PROTECTED.filter((token) => content.includes(token));
  const gate = GATE_PATTERNS.some((re) => re.test(content));

  let status = "UNVERIFIED";
  let reason = null;

  if (matched.length && !gate) {
    status = "VIOLATION";
    reason = "Direct protected evidence-table reference without a V7.22 release-gate reference.";
  } else if (matched.length && gate) {
    status = "MIXED_ACCESS";
    reason = "Direct protected evidence-table access is present; release-gate usage is also present. Review the consumer path before treating this as compliant.";
  } else if (gate) {
    status = "COMPLIANT";
  }

  return {
    path: file.replaceAll(path.sep, "/"),
    status,
    release_gate_reference: gate,
    direct_evidence_reference: matched.length > 0,
    matched_tokens: matched,
    violation_reason: reason,
  };
}

const mode = process.argv.includes("--all") ? "all" : "changed";
let files;

if (mode === "all") {
  files = walk(process.cwd());
} else {
  const raw = process.env.CROW_CHANGED_FILES || "";
  files = raw
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x && /\.(html|js)$/i.test(x))
    .filter((x) => fs.existsSync(x));
}

const results = files.map(scanFile);
const violations = results.filter((r) => r.status === "VIOLATION");
const mixed = results.filter((r) => r.status === "MIXED_ACCESS");
const compliant = results.filter((r) => r.status === "COMPLIANT");

const report = {
  scanner_version: "V7.25",
  scanned_at: new Date().toISOString(),
  mode,
  files_scanned: results.length,
  violations: violations.length,
  mixed_access: mixed.length,
  compliant_gate_consumers: compliant.length,
  results,
};

fs.mkdirSync(".evidence-compliance", { recursive: true });
fs.writeFileSync(".evidence-compliance/report.json", JSON.stringify(report, null, 2) + "\n");

console.log(JSON.stringify(report, null, 2));

if (violations.length) {
  console.error("\nV7.25 FAILED: protected evidence-table access without a V7.22 release gate was detected.");
  process.exit(1);
}

if (mixed.length) {
  console.warn("\nV7.25 WARNING: mixed direct evidence access detected. Review these consumers; direct access is not automatically considered compliant.");
}
