(() => {
  const addPartnershipLink = () => {
    const nav = document.querySelector("#primaryNav");
    if (!nav || nav.querySelector('[data-partnership-nav="true"]')) return;
    const link = document.createElement("a");
    link.href = new URL("partnerships.html", document.querySelector('link[rel="stylesheet"][href*="site.css"]')?.href || location.href).href;
    link.textContent = "Partnerships";
    link.dataset.primaryLink = "";
    link.dataset.partnershipNav = "true";
    nav.appendChild(link);
  };
  addPartnershipLink();
  const observer = new MutationObserver(addPartnershipLink);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener("pagehide", () => observer.disconnect(), {once:true});
})();