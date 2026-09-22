import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git","node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
  }
}
walk(root);

const fileSet = new Set(htmlFiles.map(f => path.relative(root, f).replaceAll(path.sep, "/")));
const inbound = new Map([...fileSet].map(f => [f, []]));
const broken = [];

function isExternal(value) {
  return /^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(value.trim());
}

for (const file of htmlFiles) {
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  const html = fs.readFileSync(file, "utf8");
  const links = [...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);

  for (const raw of links) {
    if (isExternal(raw)) continue;
    const clean = raw.split("#")[0].split("?")[0];
    if (!clean || !/\.html$/i.test(clean)) continue;

    const target = path.normalize(path.join(path.dirname(rel), clean)).replaceAll(path.sep, "/");
    if (!fileSet.has(target)) {
      broken.push({ from: rel, target: raw });
      continue;
    }
    inbound.get(target)?.push(rel);
  }
}

const required = [
  "home.html","navigation.html","podcasts.html","creators.html",
  "create-podcast.html","creator-studio.html","profile.html",
  "membership.html","account.html","support.html","site-map.html"
];

const missingRequired = required.filter(p => !fileSet.has(p));
const orphanPages = [...inbound.entries()]
  .filter(([file, from]) => from.length === 0 && !required.includes(file) && file !== "404.html")
  .map(([file]) => file)
  .sort();

console.log("CrowRules Podcasting — Navigation & User Journey 2.0");
console.log(`HTML pages: ${fileSet.size}`);
console.log(`Broken local HTML links: ${broken.length}`);
console.log(`Required journey pages missing: ${missingRequired.length}`);
console.log(`Orphan HTML pages (no inbound local HTML link): ${orphanPages.length}`);

if (broken.length) {
  console.log("\nBROKEN LINKS");
  for (const item of broken) console.log(`- ${item.from} -> ${item.target}`);
}

if (missingRequired.length) {
  console.log("\nMISSING REQUIRED JOURNEY PAGES");
  for (const item of missingRequired) console.log(`- ${item}`);
}

if (orphanPages.length) {
  console.log("\nORPHAN PAGES");
  for (const item of orphanPages) console.log(`- ${item}`);
}

if (broken.length || missingRequired.length) process.exit(1);
