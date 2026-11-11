/* Accessible motion and visual polish for public Tacoma Partnership Network pages.
   Supabase forms, listings, moderation and application logic are handled by their original modules. */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const selectors = [
    ".tacoma-photo-story-head",".tacoma-photo-card",".founding50-copy",
    ".founding50-progress-card",".intro-grid",".principles article",
    ".opportunity-card",".category-card",".feature-band",".steps article",
    ".commitment-grid article",".faq-list details",".apply-copy",".partner-form",
    ".hq-hero-inner",".about-origin-copy",".about-origin-visual",
    ".cg-hero-inner",".cg-intro > *",".cg-path",".dir-hero-inner",
    ".dir-intro > *",".dir-filter-panel",".opp-hero .hq-hero-inner",
    ".opp-principles article",".opp-pathway",".sponsor-hero-content",
    ".sponsor-offer",".sponsor-intro > *"
  ];
  const nodes = [...document.querySelectorAll(selectors.join(","))];
  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, active) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          active.unobserve(entry.target);
        }
      });
    }, {threshold: .12, rootMargin: "0px 0px -32px 0px"});
    nodes.forEach(node => {
      node.setAttribute("data-reveal", "");
      observer.observe(node);
    });
  }
  document.querySelectorAll(".tacoma-photo-card img").forEach(img => {
    img.addEventListener("error", () => img.remove(), {once:true});
  });
})();