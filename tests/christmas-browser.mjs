import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
const failures = [];
const screenshots = [];
const base = "http://127.0.0.1:4173";

async function checkViewport(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", error => failures.push(`${name}: pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") failures.push(`${name}: console: ${message.text()}`);
  });

  await page.goto(`${base}/christmas/?preview=1`, { waitUntil: "networkidle" });
  await page.locator("#cr-xmas-calendar .cr-xmas-day").first().waitFor();
  assert.equal(await page.locator("#cr-xmas-calendar .cr-xmas-day").count(), 24, "Advent calendar should render 24 days");
  assert.equal(await page.locator("#cr-xmas-calendar .cr-xmas-day:disabled").count(), 0, "Preview should unlock all days");
  assert.equal(await page.locator(".cr-xmas-world-hero").count(), 1, "Christmas World hero should render");
  assert.equal(await page.locator(".cr-xmas-feature-art img").count(), 2, "Santa and raven image panels should render");
  assert.equal(await page.locator(".cr-christmas-snow").count(), 1, "Snow ambience should render");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "Christmas World should not overflow horizontally");
  await page.screenshot({ path: `artifacts/christmas-${name}.png`, fullPage: true });
  screenshots.push(`christmas-${name}.png`);

  await page.locator("#cr-xmas-calendar .cr-xmas-day").first().click();
  assert.equal(await page.locator("#cr-xmas-dialog").evaluate(el => el.open), true, "Advent activity dialog should open");
  await page.locator("#cr-xmas-dialog-close").click();
  assert.equal(await page.locator("#cr-xmas-dialog").evaluate(el => el.open), false, "Advent activity dialog should close");
  await page.close();
}

try {
  await checkViewport("desktop", { width: 1440, height: 1000 });
  await checkViewport("mobile", { width: 390, height: 844 });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let mutationCount = 0;
  await page.goto(`${base}/?seasonalPreview=christmas`, { waitUntil: "domcontentloaded" });
  const mutations = await page.evaluate(() => new Promise(resolve => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-site-theme", "data-page"] });
    setTimeout(() => { observer.disconnect(); resolve(count); }, 1200);
  }));
  assert.ok(mutations < 50, `Preview theme should settle without an observer loop (observed ${mutations} mutations)`);
  await page.waitForSelector("#crChristmasHomeHero", { timeout: 10000 });
  assert.equal(await page.locator("#crChristmasRibbon").count(), 1, "Sitewide Christmas ribbon should mount once");
  assert.equal(await page.locator("#crChristmasHomeHero").count(), 1, "Home Christmas feature should mount once");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "Home preview should not overflow horizontally");
  await page.screenshot({ path: "artifacts/christmas-home-preview.png", fullPage: true });
  await page.close();

  if (failures.length) throw new Error(failures.join("\n"));
  console.log("Christmas desktop/mobile browser QA passed. Screenshots:", screenshots.join(", "), "and christmas-home-preview.png");
} finally {
  await browser.close();
}
