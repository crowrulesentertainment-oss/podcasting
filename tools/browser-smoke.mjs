import { chromium } from "playwright";

const base = process.env.CROWRULES_PODCASTING_BASE_URL || "https://crowrulesentertainment-oss.github.io/podcasting/";
const pages = [
  "home.html",
  "podcasts.html",
  "creators.html",
  "login.html",
  "signup.html",
  "profile.html",
  "creator-studio.html",
  "create-podcast.html",
  "upload-episode.html",
  "monetization.html",
  "payouts.html"
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];

page.on("console", msg => {
  if (msg.type() === "error") failures.push(`console: ${msg.text()}`);
});
page.on("pageerror", err => failures.push(`pageerror: ${err.message}`));

for (const path of pages) {
  const url = new URL(path, base).href;
  failures.length = 0;
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(err => {
    failures.push(`navigation: ${err.message}`);
    return null;
  });
  if (!response || !response.ok()) {
    failures.push(`http: ${response?.status() ?? "no response"}`);
  }
  console.log(`${path}: HTTP ${response?.status() ?? "ERR"}`);
  for (const failure of failures) console.log(`  - ${failure}`);
}

await browser.close();
if (failures.length) process.exitCode = 1;
