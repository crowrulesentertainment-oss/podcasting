// Homepage and site-navigation integration for CrowRules Podcasting Platform Reviews.
(() => {
  const REVIEW_URL = "/podcasting/platform-reviews.html";
  const styleId = "cr-platform-reviews-home-style";

  function addStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .cr-platform-reviews-home{position:relative;isolation:isolate;overflow:hidden;margin:clamp(28px,5vw,64px) auto;padding:clamp(26px,5vw,58px);width:min(1240px,calc(100% - 36px));border:1px solid #d7b56b55;border-radius:24px;background:radial-gradient(ellipse at 88% 18%,#b58a3826,transparent 38%),linear-gradient(125deg,#17181d 0%,#0c0d12 58%,#211416 100%);box-shadow:0 22px 65px #0005;color:#f8f5ef
      }
      .cr-platform-reviews-home:after{content:"";position:absolute;inset:auto -70px -170px auto;width:360px;height:360px;border:1px solid #d7b56b22;border-radius:50%;box-shadow:0 0 0 32px #d7b56b08,0 0 0 66px #d7b56b06;pointer-events:none}
      .cr-platform-reviews-home-inner{position:relative;z-index:1;max-width:900px}
      .cr-platform-reviews-home-kicker{display:inline-flex;align-items:center;gap:9px;color:#e7c77f;font-size:10px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}
      .cr-platform-reviews-home-kicker:before{content:"";width:28px;height:1px;background:#e7c77f}
      .cr-platform-reviews-home h2{margin:15px 0 12px;font-size:clamp(32px,5vw,58px);line-height:.98;letter-spacing:-.055em;color:#fff}
      .cr-platform-reviews-home h2 em{font-style:normal;color:#e7c77f}
      .cr-platform-reviews-home p{max-width:760px;margin:0;color:#c7c2b8;font-size:clamp(14px,1.5vw,17px);line-height:1.75}
      .cr-platform-reviews-home-points{display:flex;flex-wrap:wrap;gap:9px;margin:22px 0 26px}
      .cr-platform-reviews-home-points span{padding:8px 11px;border:1px solid #ffffff20;border-radius:999px;background:#ffffff08;color:#e7e1d5;font-size:11px;font-weight:700}
      .cr-platform-reviews-home-actions{display:flex;flex-wrap:wrap;gap:11px}
      .cr-platform-reviews-home-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 20px;border:1px solid #d9b96f;border-radius:999px;background:linear-gradient(135deg,#f0d18d,#a9772e);color:#17120a;text-decoration:none;font-size:12px;font-weight:950;letter-spacing:.04em}
      .cr-platform-reviews-home-actions a.secondary{background:#ffffff0a;color:#f5f1e8;border-color:#ffffff35}
      .cr-platform-reviews-home-actions a:hover{transform:translateY(-2px);filter:brightness(1.08)}
      @media(max-width:600px){.cr-platform-reviews-home{width:calc(100% - 24px);border-radius:18px}.cr-platform-reviews-home-actions a{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addHomeSection() {
    const app = document.querySelector("#app");
    const hero = app?.querySelector("[data-home-hero-carousel]");
    if (!hero || app.querySelector(".cr-platform-reviews-home")) return;
    addStyles();
    const section = document.createElement("section");
    section.className = "cr-platform-reviews-home";
    section.setAttribute("aria-labelledby", "cr-platform-reviews-home-title");
    section.innerHTML = `
      <div class="cr-platform-reviews-home-inner">
        <span class="cr-platform-reviews-home-kicker">YOUR VOICE SHAPES THE PLATFORM</span>
        <h2 id="cr-platform-reviews-home-title">Help make CrowRules<br><em>better for everyone.</em></h2>
        <p>CrowRules Reviews has three distinct pillars: Show Reviews, Episode Reviews and Platform Reviews. This is your place to review the platform itself—its design, discovery, listening experience, Creator Studio, community and performance—and help guide what we improve next.</p>
        <div class="cr-platform-reviews-home-points" aria-label="Platform review topics">
          <span>Usability & design</span><span>Show discovery</span><span>Listening experience</span><span>Creator Studio</span><span>Community</span><span>Performance</span>
        </div>
        <div class="cr-platform-reviews-home-actions">
          <a href="${REVIEW_URL}">Review CrowRules Podcasting ↗</a>
          <a class="secondary" href="${REVIEW_URL}#platformFeedback">Share an idea or report an issue</a>
        </div>
      </div>`;
    hero.insertAdjacentElement("afterend", section);
  }

  function addNavigationLinks() {
    const nav = document.querySelector("#primaryNav");
    if (nav && !nav.querySelector('a[href="' + REVIEW_URL + '"]')) {
      const community = [...nav.querySelectorAll(".nav-group")].find(group => group.querySelector("summary")?.textContent.trim() === "Community");
      const menu = community?.querySelector(".nav-menu");
      if (menu) {
        const link = document.createElement("a");
        link.dataset.primaryLink = "";
        link.href = REVIEW_URL;
        link.textContent = "Platform Reviews & feedback";
        menu.appendChild(link);
      }
    }
    const exploreColumn = [...document.querySelectorAll(".footer-grid > div")].find(column => column.querySelector("b")?.textContent.trim() === "Explore");
    if (exploreColumn && !exploreColumn.querySelector('a[href="' + REVIEW_URL + '"]')) {
      const link = document.createElement("a");
      link.href = REVIEW_URL;
      link.textContent = "Platform Reviews";
      exploreColumn.appendChild(link);
    }
  }

  function sync() {
    addNavigationLinks();
    if (document.body.dataset.page === "home" || document.querySelector("#app [data-home-hero-carousel]")) addHomeSection();
  }

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
  else sync();
})();
