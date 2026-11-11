/* Lightweight visual behavior for the Tacoma cinematic refresh.
   Core Supabase data, applications, directory, and moderation remain in network.js. */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(
    ".tacoma-photo-story-head,.tacoma-photo-card,.founding50-copy,.founding50-progress-card,.intro-grid,.principles article,.opportunity-card,.category-card,.feature-band,.steps article,.commitment-grid article,.faq-list details,.apply-copy,.partner-form"
  );
  if (!reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal-ready");
    revealTargets.forEach((node) => node.setAttribute("data-reveal", ""));
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
    revealTargets.forEach((node) => observer.observe(node));
  }
  document.querySelectorAll(".tacoma-photo-card img").forEach((image) => {
    image.addEventListener("error", () => {
      image.closest(".tacoma-photo-card")?.classList.add("image-unavailable");
      image.remove();
    }, { once: true });
  });
})();