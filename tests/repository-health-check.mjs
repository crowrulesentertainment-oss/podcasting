import { readdir, readFile, stat, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", "dist", "coverage"]);
const problems = [];
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(path.relative(root, full).split(path.sep).join("/"));
  }
}
function checkSyntax(source, label, ext = ".mjs") {
  const dir = syntaxDir;
  const file = path.join(dir, "check.mjs");
  // Each check is sequential so this temporary filename is safe.
  return writeFile(file, source, "utf8").then(() => {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) problems.push(label + ": " + (result.stderr || result.stdout || "syntax check failed").trim());
  });
}
const syntaxDir = await mkdtemp(path.join(os.tmpdir(), "cr-health-"));
try {
  await walk(root);
  const htmlFiles = files.filter(f => f.toLowerCase().endsWith(".html"));
  const jsFiles = files.filter(f => /\.(?:js|mjs|cjs)$/i.test(f));
  console.log("Checking " + jsFiles.length + " JavaScript files and " + htmlFiles.length + " HTML pages.");

  for (const file of jsFiles) {
    await checkSyntax(await readFile(path.join(root, file), "utf8"), file, ".mjs");
  }

  for (const file of htmlFiles) {
    const html = await readFile(path.join(root, file), "utf8");
    const scriptTags = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match, inlineIndex = 0;
    while ((match = scriptTags.exec(html))) {
      const attrs = match[1] || "";
      const code = match[2] || "";
      if (/\bsrc\s*=/.test(attrs) || !code.trim()) continue;
      const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
      if (/json|ld\+json|importmap/i.test(type)) continue;
      inlineIndex++;
      await checkSyntax(code, file + " inline script #" + inlineIndex, ".mjs");
    }

    const attr = /\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi;
    while ((match = attr.exec(html))) {
      let value = match[2].trim();
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value) || /[{}<>]/.test(value) || value.includes("+")) continue;
      value = value.split("#")[0].split("?")[0];
      if (!value) continue;
      try { value = decodeURIComponent(value); } catch {}
      let target;
      if (value.startsWith("/")) {
        value = value.replace(/^\/+/, "");
        if (value.startsWith("podcasting/")) value = value.slice("podcasting/".length);
        target = path.join(root, value);
      } else {
        target = path.resolve(root, path.dirname(file), value);
      }
      const candidates = [target];
      if (value.endsWith("/")) candidates.push(path.join(target, "index.html"));
      if (!path.extname(target)) candidates.push(path.join(target, "index.html"));
      let exists = false;
      for (const candidate of candidates) {
        try { if ((await stat(candidate)).isFile()) { exists = true; break; } } catch {}
      }
      if (!exists) problems.push(file + ": missing local resource " + match[2]);
    }
  }

  for (const file of files.filter(f => f.endsWith(".json"))) {
    try { JSON.parse(await readFile(path.join(root, file), "utf8")); }
    catch (error) { problems.push(file + ": invalid JSON: " + error.message); }
  }

  const config = files.includes("config.js") ? await readFile(path.join(root, "config.js"), "utf8") : "";
  if (/service_role|sb_secret_/i.test(config)) problems.push("config.js: possible privileged Supabase secret in public browser configuration.");

  if (problems.length) {
    console.error("\nRepository health check found " + problems.length + " issue(s):");
    for (const problem of problems) console.error(" - " + problem);
    process.exitCode = 1;
  } else {
    console.log("PASS: JavaScript syntax, inline scripts, local HTML resources, JSON, and public-config secret scan.");
  }
} finally {
  await rm(syntaxDir, { recursive: true, force: true });
}
