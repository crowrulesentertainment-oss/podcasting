(() => {
  const addLink = () => {
    const nav = document.querySelector(".nav, #primaryNav, [data-primary-nav]");
    if (!nav || nav.querySelector('[data-partnership-nav="true"]')) return;
    const link = document.createElement("a");
    link.href = new URL("partnerships.html", location.href).href;
    link.textContent = "Partnerships";
    link.dataset.partnershipNav = "true";
    nav.appendChild(link);
  };
  addLink();
  const observer = new MutationObserver(addLink);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener("pagehide", () => observer.disconnect(), {once:true});
})();