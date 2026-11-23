import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const groupsCss = await readFile(new URL("../assets/css/groups.css", import.meta.url), "utf8");

const BASE = "http://127.0.0.1:4173/tests/groups-browser.html";
const GROUP_ID = "test-circle";
const USER_ID = "test-member";
const OWNER_ID = "test-owner";

const mockClient = `
const state = window.__GROUPS_TEST_STATE;
const matches = (row, filters) => filters.every(([kind, key, value]) => {
  if (kind === "eq") return row?.[key] === value;
  if (kind === "is") return value === null ? row?.[key] == null : row?.[key] === value;
  if (kind === "in") return value.includes(row?.[key]);
  if (kind === "neq") return row?.[key] !== value;
  return true;
});
function rowsFor(table) {
  if (table === "podcast_community_circles") return state.circles;
  if (table === "podcast_community_circle_members") return state.members;
  if (table === "podcast_community_circle_posts") return state.posts;
  if (table === "podcast_community_circle_replies") return state.replies;
  if (table === "crowrules_public_profiles") return state.profiles;
  return [];
}
function from(table) {
  const filters = [];
  let operation = "select";
  let payload = null;
  const q = {
    select() { return q; },
    eq(key, value) { filters.push(["eq", key, value]); return q; },
    neq(key, value) { filters.push(["neq", key, value]); return q; },
    is(key, value) { filters.push(["is", key, value]); return q; },
    in(key, value) { filters.push(["in", key, value]); return q; },
    order() { return q; },
    limit() { return q; },
    insert(value) { operation = "insert"; payload = value; return q; },
    delete() { operation = "delete"; return q; },
    async maybeSingle() { const data = rowsFor(table).filter(row => matches(row, filters))[0] || null; return { data, error: null }; },
    then(resolve, reject) { return Promise.resolve().then(() => {
      if (operation === "insert") {
        if (table === "podcast_community_circle_members") {
          if (state.members.some(row => row.circle_id === payload.circle_id && row.member_id === payload.member_id)) {
            return { data: null, error: { message: "duplicate membership" } };
          }
          state.members.push({ ...payload, joined_at: new Date().toISOString() });
        } else if (table === "podcast_community_circle_posts") {
          state.posts.unshift({ ...payload, id: "post-" + (state.posts.length + 1), created_at: new Date().toISOString(), is_locked: false, is_pinned: false });
        } else if (table === "podcast_community_circle_replies") {
          const parent = state.posts.find(post => post.id === payload.post_id);
          if (!parent || parent.is_locked) return { data: null, error: { message: "reply closed" } };
          state.replies.push({ ...payload, id: "reply-" + (state.replies.length + 1), created_at: new Date().toISOString() });
        }
        return { data: null, error: null };
      }
      if (operation === "delete") {
        state.members = state.members.filter(row => !matches(row, filters));
        return { data: null, error: null };
      }
      return { data: rowsFor(table).filter(row => matches(row, filters)), error: null };
    }).then(resolve, reject); }
  };
  return q;
}
export const sb = {
  from,
  auth: { async getUser() { return { data: { user: state.user }, error: null }; } }
};
`;

function initialState(role = "member", options = {}) {
  const user = role === "signed-out" ? null : { id: role === "owner" ? OWNER_ID : USER_ID };
  const membership = role === "member" ? [{ circle_id: GROUP_ID, member_id: USER_ID, role: "member" }]
    : role === "owner" ? [{ circle_id: GROUP_ID, member_id: OWNER_ID, role: "owner" }] : [];
  return {
    user,
    circles: [
      { id: GROUP_ID, owner_id: OWNER_ID, name: "Test Community", description: "A browser test group", category: "General", is_public: true, is_featured: false, created_at: "2026-01-01T00:00:00Z", community_rules: "Be kind", branch_key: "test" },
      { id: "private-circle", owner_id: OWNER_ID, name: "Private Hidden Group", description: "Must not appear", category: "General", is_public: false, created_at: "2026-01-01T00:00:00Z" }
    ],
    members: membership,
    posts: options.noPosts ? [] : [{
      id: "post-one", circle_id: GROUP_ID, author_id: OWNER_ID,
      body: options.body || "Welcome to the test community",
      created_at: "2026-01-02T00:00:00Z", is_locked: Boolean(options.locked), is_pinned: false
    }],
    replies: [{ id: "reply-one", post_id: "post-one", circle_id: GROUP_ID, author_id: OWNER_ID, body: "A test reply", created_at: "2026-01-03T00:00:00Z" }],
    profiles: [{ user_id: OWNER_ID, display_name: "Test Owner", username: "owner" }]
  };
}

async function openPage(browser, role, options = {}, query = "?preview=1&group=" + GROUP_ID) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const state = initialState(role, options);
  await page.addInitScript((value) => {
    window.__GROUPS_TEST_STATE = value;
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : ["2026-11-22T12:00:00Z"])); }
      static now() { return new RealDate("2026-11-22T12:00:00Z").getTime(); }
    }
    window.Date = FixedDate;
  }, state);
  await page.route("**/podcasting/assets/css/groups.css*", route => route.fulfill({
    status: 200, contentType: "text/css", body: groupsCss
  }));
  await page.route("**/assets/js/client.js", route => route.fulfill({
    status: 200, contentType: "text/javascript", body: mockClient
  }));
  await page.goto(BASE + query);
  await page.waitForSelector("#crg-root");
  return { page, state };
}

const browser = await chromium.launch({ headless: true });
const passed = [];
try {
  {
    const { page } = await openPage(browser, "signed-out", {}, "?preview=1");
    await page.waitForSelector("#crg-search");
    assert.equal(await page.locator(".crg-card").count(), 1, "only public groups should be listed");
    await page.locator("#crg-search").fill("does not exist");
    assert.match(await page.locator("#crg-grid").innerText(), /No public groups match/);
    await page.locator("#crg-search").fill("Test Community");
    assert.equal(await page.locator(".crg-card").count(), 1);
    passed.push("public directory, search, private-group exclusion");
    await page.close();
  }
  {
    const { page } = await openPage(browser, "signed-out");
    await page.waitForSelector("#crg-membership a");
    assert.match(await page.locator("#crg-membership").innerText(), /Sign in to join/);
    assert.match(await page.locator("#crg-posts").innerText(), /Sign in to view replies/);
    assert.equal(await page.locator("form[data-action='create-post']").count(), 0);
    assert.equal(await page.locator(".crg-reply-form").count(), 0);
    passed.push("signed-out visitor guidance and reply restrictions");
    await page.close();
  }
  {
    const { page, state } = await openPage(browser, "nonmember");
    await page.waitForSelector("#crg-join");
    await page.locator("#crg-join").click();
    await page.waitForSelector("#crg-new-post");
    assert.equal(await page.evaluate(() => window.__GROUPS_TEST_STATE.members.length), 1);
    await page.locator("#crg-new-post").fill("A new member post");
    await page.getByRole("button", { name: "Publish post" }).click();
    await page.getByText("A new member post").waitFor();
    assert.equal(await page.evaluate(() => window.__GROUPS_TEST_STATE.posts[0].body), "A new member post");
    passed.push("nonmember join and member post submission");
    await page.close();
  }
  {
    const { page, state } = await openPage(browser, "member");
    await page.waitForSelector(".crg-reply-form textarea");
    await page.locator(".crg-reply-form textarea").fill("A member reply");
    await page.getByRole("button", { name: "Reply" }).click();
    await page.getByText("A member reply").waitFor();
    assert.equal(await page.evaluate(() => window.__GROUPS_TEST_STATE.replies.at(-1).body), "A member reply");
    await page.getByRole("button", { name: "Leave community" }).click();
    await page.getByRole("button", { name: "Join community" }).waitFor();
    assert.equal(await page.evaluate(() => window.__GROUPS_TEST_STATE.members.length), 0);
    passed.push("member reply submission and leave flow");
    await page.close();
  }
  {
    const { page } = await openPage(browser, "signed-out", {}, "?preview=1");
    await page.waitForSelector("#crg-search");
    await page.locator("#crg-search").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("data-category"), "all", "keyboard tab should reach the first category filter");
    assert.equal(await page.locator(":focus").getAttribute("aria-pressed"), "true", "active filter state should be exposed");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("data-category"), "General", "keyboard tab should reach the next category filter");
    const focusOutline = await page.locator(":focus").evaluate(el => getComputedStyle(el).outlineWidth);
    assert.equal(focusOutline, "2px", "focused category filter should have a visible focus outline");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-category='General']").getAttribute("aria-pressed"), "true", "Enter should activate the focused category filter");
    await page.close();

    const memberPage = await openPage(browser, "nonmember");
    await memberPage.page.waitForSelector("#crg-join");
    await memberPage.page.locator("#crg-join").focus();
    await memberPage.page.keyboard.press("Enter");
    await memberPage.page.waitForSelector("#crg-new-post");
    assert.equal(await memberPage.page.evaluate(() => window.__GROUPS_TEST_STATE.members.length), 1, "Enter should activate join");
    passed.push("keyboard navigation, visible focus, filter state, and join activation");
    await memberPage.page.close();
  }
  {
    const { page } = await openPage(browser, "owner");
    await page.waitForSelector("#crg-membership");
    assert.match(await page.locator("#crg-membership").innerText(), /You own this community/);
    assert.equal(await page.getByRole("button", { name: "Leave community" }).count(), 0);
    passed.push("owner self-leave protection");
    await page.close();
  }
  {
    const { page } = await openPage(browser, "member", { locked: true });
    await page.waitForSelector(".crg-post");
    assert.match(await page.locator(".crg-post").innerText(), /Replies are closed/);
    assert.equal(await page.locator(".crg-reply-form").count(), 0);
    passed.push("locked-post reply form suppression");
    await page.close();
  }
  {
    const hostile = '<img src=x onerror=alert(1)> <script>alert(2)</script>';
    const { page } = await openPage(browser, "signed-out", { body: hostile });
    await page.waitForSelector(".crg-post-body");
    assert.equal(await page.locator(".crg-post-body img, .crg-post-body script").count(), 0);
    assert.equal(await page.locator(".crg-post-body").innerText(), hostile);
    passed.push("untrusted post text is rendered as text");
    await page.close();
  }
  {
    const { page } = await openPage(browser, "signed-out", {}, "?preview=1");
    await page.waitForSelector(".crg-preview-bar");
    assert.match(await page.locator(".crg-preview-bar").innerText(), /December 1, 2026/);
    await page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth), true, "320px layout should not overflow horizontally");
    passed.push("preview launch gate and narrow mobile viewport");
    await page.close();
  }
  {
    const { page } = await openPage(browser, "signed-out", {}, "?preview=1");
    await page.waitForSelector("#crg-root");
    const accessibility = await new AxeBuilder({ page })
      .include("#crg-root")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const violations = accessibility.violations.map(item => ({
      id: item.id,
      impact: item.impact,
      description: item.description,
      nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
    }));
    if (violations.length) console.error("AXE VIOLATIONS: " + JSON.stringify(violations, null, 2));
    assert.equal(violations.length, 0, "Groups interface should have no WCAG 2.1 A/AA axe violations");
    passed.push("axe-core WCAG 2.1 A/AA scan of Groups interface");
    await page.close();
  }
  console.log("PASS: " + passed.length + " Groups browser scenarios");
  for (const item of passed) console.log(" - " + item);
} finally {
  await browser.close();
}
