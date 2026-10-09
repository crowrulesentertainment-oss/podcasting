import { chromium } from "playwright";

const BASE_URL = "https://crowrulesentertainment-oss.github.io/podcasting/home.html";
const TIMEOUT = 90_000;

function installPresenceRecorder(page) {
  return page.addInitScript(() => {
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
}

async function latestEvent(page) {
  return page.evaluate(() => window.__crowOnlineEvents[window.__crowOnlineEvents.length - 1]);
}

async function waitForEvent(page, condition, baseline, label) {
  const predicate = condition === "initial"
    ? () => window.__crowOnlineEvents && window.__crowOnlineEvents.length > 0
    : condition === "increase"
      ? value => (window.__crowOnlineEvents || []).some(e => e.guest >= value + 1)
      : value => (window.__crowOnlineEvents || []).slice(value.startIndex).some(e => e.guest < value.guest);
  await page.waitForFunction(predicate, baseline, { timeout: TIMEOUT, polling: 500 }).catch(async error => {
    const events = await page.evaluate(() => window.__crowOnlineEvents || []).catch(() => []);
    throw new Error(label + " timed out. Recent events: " + JSON.stringify(events.slice(-8)) + ". " + error.message);
  });
}

function assertTotal(counts, stage) {
  if (!counts || counts.all !== counts.listener + counts.creator + counts.guest) {
    throw new Error("Counter arithmetic failed at " + stage + ": " + JSON.stringify(counts));
  }
}

const browser = await chromium.launch({ headless: true });
const firstContext = await browser.newContext();
const firstPage = await firstContext.newPage();

try {
  await installPresenceRecorder(firstPage);
  await firstPage.goto(BASE_URL + "?presenceBrowserTest=" + Date.now(), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await waitForEvent(firstPage, "initial", null, "Initial Supabase Realtime presence event");

  const baseline = await latestEvent(firstPage);
  assertTotal(baseline, "baseline");
  console.log("PASS: first browser session received presence counts: " + JSON.stringify(baseline));

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await installPresenceRecorder(secondPage);
    await secondPage.goto(BASE_URL + "?presenceBrowserTest=" + (Date.now() + 1), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await waitForEvent(secondPage, "initial", null, "Second browser session presence event");

    await waitForEvent(firstPage, "increase", baseline.guest, "Guest counter increase after second session");
    const afterJoin = await latestEvent(firstPage);
    assertTotal(afterJoin, "after join");
    if (afterJoin.guest < baseline.guest + 1) {
      throw new Error("Second browser session did not increase the guest count. Baseline=" + JSON.stringify(baseline) + " latest=" + JSON.stringify(afterJoin));
    }
    console.log("PASS: opening a second independent browser session increased guest presence: " + JSON.stringify({ baseline, afterJoin }));

    const eventCountBeforeClose = await firstPage.evaluate(() => (window.__crowOnlineEvents || []).length);
    await secondContext.close();
    await waitForEvent(
      firstPage,
      "decrease",
      { guest: afterJoin.guest, startIndex: eventCountBeforeClose },
      "Guest counter decrease after second session closes"
    );
    const afterLeave = await latestEvent(firstPage);
    assertTotal(afterLeave, "after leave");
    if (afterLeave.guest >= afterJoin.guest) {
      throw new Error("Closing the second browser session did not reduce guest presence. AfterJoin=" + JSON.stringify(afterJoin) + " latest=" + JSON.stringify(afterLeave));
    }
    console.log("PASS: closing the second browser session reduced guest presence: " + JSON.stringify({ afterJoin, afterLeave }));
  } finally {
    await secondContext.close().catch(() => {});
  }
} finally {
  await firstContext.close().catch(() => {});
  await browser.close();
}
