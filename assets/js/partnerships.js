(() => {
  "use strict";
  const email = "crowrulesentertainment@gmail.com";
  const partners = []; // Add only confirmed partners here; never publish pending applicants.
  const directory = document.getElementById("partnerDirectory");
  const form = document.getElementById("partnerForm");
  const typeSelect = document.getElementById("partnershipType");
  const feedback = document.getElementById("formFeedback");

  document.getElementById("currentYear").textContent = new Date().getFullYear();

  function renderPartners() {
    if (!directory) return;
    if (!partners.length) {
      directory.innerHTML = '<div class="partner-empty"><div><div class="empty-emblem">✦</div><h3>Our partner story starts here.</h3><p>We are opening the door to our first official partnership conversations. Could your organization be part of what comes next?</p></div></div>';
      return;
    }
    directory.innerHTML = partners.map(partner => {
      const safe = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
      const link = /^https?:\/\//i.test(partner.url || "") ? partner.url : "";
      return '<article class="partner-card"><h3>' + safe(partner.name) + '</h3><span class="section-label">' + safe(partner.category) + '</span><p>' + safe(partner.description) + '</p>' + (link ? '<a href="' + safe(link) + '" target="_blank" rel="noopener noreferrer">Visit partner ↗</a>' : '') + '</article>';
    }).join("");
  }
  renderPartners();

  document.querySelectorAll("[data-type]").forEach(link => link.addEventListener("click", () => {
    if (typeSelect) typeSelect.value = link.dataset.type;
  }));

  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const organization = String(data.get("organization") || "").trim();
    const sender = String(data.get("email") || "").trim();
    const website = String(data.get("website") || "").trim();
    const type = String(data.get("type") || "").trim();
    const message = String(data.get("message") || "").trim();
    const subject = "CrowRules Podcasting Partnership Inquiry — " + (organization || name);
    const body = [
      "PARTNERSHIP INQUIRY",
      "",
      "Name: " + name,
      "Organization: " + (organization || "Not provided"),
      "Email: " + sender,
      "Website / social: " + (website || "Not provided"),
      "Partnership type: " + type,
      "",
      "IDEA / DETAILS",
      message,
      "",
      "I understand this is an inquiry only and that any partnership terms must be discussed and agreed separately."
    ].join("\n");
    const mailto = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    if (feedback) feedback.textContent = "Your email draft is ready. Review it and press Send in your email app to submit the inquiry.";
    window.location.href = mailto;
  });

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    document.querySelectorAll(".value-strip article,.opportunity-card,.process-steps article,.partner-form").forEach(element => {
      element.classList.add("reveal");
      observer.observe(element);
    });
  }
})();