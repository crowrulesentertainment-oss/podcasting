import { chromium } from "playwright";

const BASE_URL = "https://crowrulesentertainment-oss.github.io/podcasting/home.html";
const TIMEOUT = 90_000;

async function waitForPresence(page, predicate, label) {
  await page.waitForFunction(
    predicate,
    null,
    { timeout: TIMEOUT, polling: 500 }
  ).catch(async error => {
    const events = await page.evaluate(() => window.__crowOnlineEvents || []).catch(() => []);
    throw new Error(label + " timed out. Recent presence events: " + JSON.stringify(events.slice(-8)) + ". " + error.message);
  });
}

const browser = await chromium.launch({ headless: true });
const firstContext = await browser.newContext();
const firstPage = await firstContext.newPage();

try {
  await firstPage.addInitScript(() => {
    window.__crowOnlineEvents = [];
    window.addEventListener("crowrules:online", event => {
      const d = event.detail || {};
      window.__crowOnlineEvents.push({
        all: Number(d.all) || 0,
        listener: Number(d.listener) || 0,
        creator: Number(d.creator) || 0,
        guest: Number(d.guest) || 0,
        at: Date.now()
      });
    });
  });

  await firstPage.goto(BASE_URL + "?presenceBrowserTest=" + Date.now(), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await waitForPresence(firstPage, () => window.__crowOnlineEvents && window.__crowOnlineEvents.length > 0, "Initial Supabase Realtime presence event");

  const baseline = await firstPage.evaluate(() => window.__crowOnlineEvents[window.__crowOnlineEvents.length - 1]);
  if (baseline.all !== baseline.listener + baseline.creator + baseline.guest) {
    throw new Error("Counter arithmetic failed at baseline: " + JSON.stringify(baseline));
  }
  console.log("PASS: first browser session received presence counts: " + JSON.stringify(baseline));

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await secondPage.addInitScript(() => {
      window.__crowOnlineEvents = [];
      window.addEventListener("crowrules:online", event => {
        const d = event.detail || {};
        window.__crowOnlineEvents.push({
          all: Number(d.all) || 0,
          listener: Number(d.listener) || 0,
          creator: Number(d.creator) || 0,
          guest: Number(d.guest) || 0,
          at: Date.now()
        });
      });
    });
    await secondPage.goto(BASE_URL + "?presenceBrowserTest=" + (Date.now() + 1), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await waitForPresence(secondPage, () => window.__crowOnlineEvents && window.__crowOnlineEvents.length > 0, "Second browser session presence event");
    await waitForPresence(firstPage, () => {
      const events = window.__crowOnlineEvents || [];
      return events.some(e => e.guest >= BASELINE_GUEST + 1);
    }.toString().replace("BASELINE_GUEST", String(baseline.guest)), "Guest counter increase after second session");

    const afterJoin = await firstPage.evaluate(() => window.__crowOnlineEvents[window.__crowOnlineEvents.length - 1]);
    if (afterJoin.all !== afterJoin.listener + afterJoin.creator + afterJoin.guest) {
      throw new Error("Counter arithmetic failed after join: " + JSON.stringify(afterJoin));
    }
    console.log("PASS: opening a second independent browser session increased guest presence: " + JSON.stringify({ baseline, afterJoin }));

    await secondContext.close();
    await waitForPresence(firstPage, () => (window.__crowOnlineEvents || []).some(e => e.guest < JOINED_GUEST), "Guest counter decrease after second session closes");
    const afterLeave = await firstPage.evaluate(() => window.__crowOnlineEvents[window.__crowOnlineEvents.length - 1]);
    if (afterLeave.all !== afterLeave.listener + afterLeave.creator + afterLeave.guest) {
      throw new Error("Counter arithmetic failed after leave: " + JSON.stringify(afterLeave));
    }
    console.log("PASS: closing the second browser session reduced guest presence: " + JSON.stringify({ afterJoin, afterLeave }));
  } finally {
    await secondContext.close().catch(() => {});
  }
} finally {
  await firstContext.close().catch(() => {});
  await browser.close();
}
