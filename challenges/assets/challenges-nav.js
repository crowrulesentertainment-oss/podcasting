/* Shared navigation for every CrowRules Podcasting Challenge Center page. */
(() => {
  const header = document.querySelector("header.head");
  if (!header) return;
  const challengesHome = "https://crowrulesentertainment-oss.github.io/podcasting/challenges/";
  const podcastHome = "https://crowrulesentertainment-oss.github.io/podcasting/";
  const href = (path) => challengesHome + path;
  const groups = [
    { label: "Explore", links: [
      ["Challenge Headquarters", "index.html"],
      ["Community Voting", "vote/index.html"],
      ["Annual Calendar", "calendar/index.html"],
      ["Challenge History", "history/index.html"],
      ["Challenge Episodes", "episodes/index.html"]
    ]},
    { label: "Challenges", links: [
      ["Thanksgiving Challenge", "thankful-voices/index.html"],
      ["Christmas Challenge", "christmas-voices/index.html"],
      ["New Year Challenge", "new-year/index.html"],
      ["Valentine's Challenge", "valentines/index.html"],
      ["Easter Challenge", "easter/index.html"],
      ["Mother's Day Challenge", "mothers-day/index.html"],
      ["Father's Day Challenge", "fathers-day/index.html"],
      ["Independence Day Challenge", "independence-day/index.html"],
      ["Back-to-School Challenge", "back-to-school/index.html"],
      ["Halloween Challenge", "halloween/index.html"],
      ["Veterans Day Challenge", "veterans-day/index.html"]
    ]},
    { label: "Creator Center", links: [
      ["Submit Your Work", "submissions/index.html"],
      ["My Challenges", "my-challenges/index.html"],
      ["Creator Showcase", "showcase/index.html"],
      ["How It Works", "how-it-works/index.html"],
      ["Challenge Rules", "rules/index.html"]
    ]},
    { label: "Recognition", links: [
      ["Founding Creators", "founding-creators/index.html"],
      ["Creator Achievements", "rewards/index.html"]
    ]}
  ];
  const current = location.pathname.replace(/\/$/, "/index.html");
  const nav = document.createElement("nav");
  nav.className = "nav cr-shared-nav";
  nav.setAttribute("aria-label", "Challenge Center navigation");
  for (const group of groups) {
    const details = document.createElement("details");
    details.className = "nav-menu";
    const summary = document.createElement("summary");
    summary.innerHTML = group.label + ' <span aria-hidden="true">▾</span>';
    const dropdown = document.createElement("div");
    dropdown.className = "nav-dropdown";
    for (const [label, path] of group.links) {
      const link = document.createElement("a");
      link.href = href(path);
      link.textContent = label;
      const target = new URL(link.href, location.href).pathname.replace(/\/$/, "/index.html");
      if (target === current) {
        link.setAttribute("aria-current", "page");
        details.open = true;
      }
      dropdown.append(link);
    }
    details.append(summary, dropdown);
    nav.append(details);
  }
  const back = document.createElement("a");
  back.className = "nav-back";
  back.href = podcastHome;
  back.textContent = "← Back to CrowRules Podcasting";
  nav.append(back);
  const oldNav = header.querySelector("nav");
  if (oldNav) oldNav.replaceWith(nav);
  else header.append(nav);
  const brand = header.querySelector(".brand");
  if (brand) brand.href = href("index.html");
  nav.addEventListener("toggle", (event) => {
    if (event.target.tagName === "DETAILS" && event.target.open) {
      nav.querySelectorAll("details[open]").forEach(item => {
        if (item !== event.target) item.open = false;
      });
    }
  }, true);
})();
