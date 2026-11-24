/* CrowRules Podcasting Christmas 2026 — additive seasonal experience.
 * No database writes, auth changes, or changes to playback/creator workflows.
 */
(() => {
  "use strict";
  const PREVIEW = new URLSearchParams(location.search).get("seasonalPreview") === "christmas";
  const isWorldPage = /\/christmas\/?$/.test(location.pathname);
  const isLivePage = /\/live\/?$/.test(location.pathname);
  const now = new Date();
  const christmasWindow = now.getFullYear() === 2026 && now.getMonth() === 11 && now.getDate() >= 1 && now.getDate() <= 25;
  const cssHref = new URL("../css/christmas-experience.css", import.meta.url).href;
  function loadCss() {
    if (document.querySelector('link[data-cr-christmas-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    link.dataset.crChristmasCss = "true";
    document.head.appendChild(link);
  }
  function previewTheme() {
    if (!PREVIEW || !document.body) return;
    document.documentElement.dataset.siteTheme = "christmas";
    document.body.dataset.siteTheme = "christmas";
    document.documentElement.style.setProperty("--cr-site-accent", "#e8c77b");
    document.documentElement.style.setProperty("--cr-site-glow", "rgba(83,190,158,.26)");
    document.documentElement.style.setProperty("--cr-site-panel", "rgba(7,24,29,.94)");
    document.documentElement.style.setProperty("--cr-site-ink", "#f8fbff");
    document.documentElement.style.setProperty("--cr-site-muted", "#c8d9df");
  }
  function active() {
    return PREVIEW || isWorldPage || christmasWindow || document.body?.dataset.siteTheme === "christmas";
  }
  function mountRibbon() {
    if (!active() || document.getElementById("crChristmasRibbon") || isWorldPage) return;
    const ribbon = document.createElement("div");
    ribbon.id = "crChristmasRibbon";
    ribbon.className = "cr-xmas-ribbon";
    ribbon.innerHTML = '<span class="cr-xmas-raven" aria-hidden="true">🐦‍⬛</span><strong>CROWRULES CHRISTMAS 2026</strong><span>A world of stories. A season of wonder.</span><a href="/podcasting/christmas/">ENTER CHRISTMAS WORLD ↗</a>';
    const nav = document.querySelector(".crp-nav,.topbar,nav[aria-label='Main navigation'],#globalNav");
    if (nav?.parentNode) nav.insertAdjacentElement("afterend", ribbon);
    else {
      const app = document.getElementById("app");
      if (app?.parentNode) app.insertAdjacentElement("beforebegin", ribbon);
      else document.body.prepend(ribbon);
    }
  }
  function mountHomeHero() {
    if (!active() || document.body.dataset.page !== "home" || document.getElementById("crChristmasHomeHero")) return;
    const carousel = document.querySelector(".home-hero-carousel");
    if (!carousel) return;
    const hero = document.createElement("section");
    hero.id = "crChristmasHomeHero";
    hero.className = "cr-xmas-home-hero";
    hero.setAttribute("aria-labelledby", "crChristmasHomeTitle");
    hero.innerHTML = '<div class="cr-xmas-home-copy"><div class="cr-xmas-kicker">✦ THE CROWRULES CHRISTMAS EXPERIENCE · 2026</div><h1 id="crChristmasHomeTitle">Where every story feels like <em>Christmas.</em></h1><p>Step into a cinematic winter world of voices, creativity and community. Discover holiday stories, meet creators and make something memorable this season.</p><div class="cr-xmas-actions"><a class="cr-xmas-primary" href="/podcasting/christmas/">EXPLORE CHRISTMAS WORLD</a><a class="cr-xmas-secondary" href="/podcasting/challenges/christmas-voices/">SHARE A CHRISTMAS STORY</a></div></div><div class="cr-xmas-scene-note">A WINTER WORLD BY CROWRULES ENTERTAINMENT</div>';
    carousel.insertAdjacentElement("beforebegin", hero);
  }
  function applyPageAtmosphere() {
    if (!active()) return;
    document.body.classList.add("cr-xmas-season");
    if (!document.getElementById("crChristmasSnow")) { const snow=document.createElement("div"); snow.id="crChristmasSnow"; snow.className="cr-christmas-snow"; snow.setAttribute("aria-hidden","true"); document.body.appendChild(snow); }
    const page = String(document.body.dataset.page || "").toLowerCase();
    if (page === "creator" || /creator|studio/.test(location.pathname)) document.body.classList.add("cr-christmas-lodge");
  }
  function refresh() {
    if (PREVIEW) previewTheme();
    if (!active()) return;
    loadCss();
    mountRibbon();
    mountHomeHero();
    applyPageAtmosphere();
  }
  function init() {
    if (PREVIEW || isWorldPage || (isLivePage && christmasWindow)) loadCss();
    refresh();
    const observer = new MutationObserver(() => refresh());
    observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:["data-site-theme","data-page"]});
    window.addEventListener("cr:site-theme-change", refresh);
    window.addEventListener("cr:page-changed", refresh);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
  window.CRPChristmasExperience = Object.freeze({version:"2026.1", preview:PREVIEW});
})();
