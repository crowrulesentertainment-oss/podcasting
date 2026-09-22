import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}

walk(root);

const external = /^(https?:|mailto:|tel:|javascript:|data:|#)/i;
const attr = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const failures = [];

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, "utf8");
  let match;
  while ((match = attr.exec(source))) {
    const ref = match[1].trim();
    if (!ref || external.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) {
      failures.push(path.relative(root, file) + " -> " + ref);
    }
  }
}

if (failures.length) {
  console.error("Broken local links:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Checked " + htmlFiles.length + " HTML files: no broken local href/src targets found.");