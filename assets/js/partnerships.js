import { sb } from "./client.js";

(() => {
  "use strict";
  const directory = document.getElementById("partnerDirectory");
  const form = document.getElementById("partnerForm");
  const typeSelect = document.getElementById("partnershipType");
  const feedback = document.getElementById("formFeedback");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  document.getElementById("currentYear").textContent = new Date().getFullYear();

  async function track(eventType, partnerId = null) {
    try {
      await sb.from("podcast_partnership_events").insert({
        event_type: eventType,
        partner_id: partnerId,
        campaign_key: new URLSearchParams(location.search).get("utm_campaign")?.slice(0,100) || null,
        campaign_source: new URLSearchParams(location.search).get("utm_source")?.slice(0,100) || null,
        campaign_medium: new URLSearchParams(location.search).get("utm_medium")?.slice(0,100) || null,
        campaign_content: new URLSearchParams(location.search).get("utm_content")?.slice(0,150) || null,
        referral_code: new URLSearchParams(location.search).get("ref")?.slice(0,100) || null,
        page_path: location.pathname.slice(0,300),
        referrer_host: document.referrer ? new URL(document.referrer).hostname.slice(0,160) : null
      });
    } catch (_) { /* Analytics must never interrupt the public page. */ }
  }
  track("page_view");
  document.querySelectorAll('a[href="#apply"]').forEach(a => a.addEventListener("click", () => track("apply_click")));
  document.querySelectorAll('a[href="partnerships-media-kit.html"]').forEach(a => a.addEventListener("click", () => track("media_kit_open")));

  function partnerCard(p) {
    const logo = p.logo_url && /^https:\/\//i.test(p.logo_url) ? '<img src="' + esc(p.logo_url) + '" alt="' + esc(p.organization_name) + ' logo" loading="lazy">' : '<div class="partner-card-monogram">' + esc(p.organization_name.slice(0,2).toUpperCase()) + '</div>';
    const link = p.website_url && /^https:\/\//i.test(p.website_url) ? '<a href="' + esc(p.website_url) + '" target="_blank" rel="noopener noreferrer" data-partner-link="' + esc(p.id) + '">Visit partner ↗</a>' : "";
    return '<article class="partner-card">' + logo + '<span class="partner-tier">' + esc(p.recognition_tier) + '</span><h3>' + esc(p.organization_name) + '</h3><p>' + esc(p.short_description) + '</p>' + link + '</article>';
  }
  async function loadPartners() {
    if (!directory) return;
    const { data, error } = await sb.from("podcast_public_partners").select("id,organization_name,short_description,category,recognition_tier,logo_url,website_url,is_featured,spotlight_month,spotlight_title,spotlight_story,episode_url,sort_order").eq("is_active", true).order("sort_order").order("organization_name");
    if (error) {
      directory.innerHTML = '<div class="partner-empty"><div><div class="empty-emblem">✦</div><h3>Our partner story starts here.</h3><p>Our public directory is being prepared. Partnership inquiries are open.</p></div></div>';
      return;
    }
    if (!data?.length) {
      directory.innerHTML = '<div class="partner-empty"><div><div class="empty-emblem">✦</div><h3>Our partner story starts here.</h3><p>We are opening the door to our first official partnership conversations. Could your organization be part of what comes next?</p></div></div>';
      return;
    }
    directory.innerHTML = data.map(partnerCard).join("");
    directory.querySelectorAll("[data-partner-link]").forEach(link => link.addEventListener("click", () => track("partner_click", link.dataset.partnerLink)));
    const spotlight = data.find(p => p.is_featured && (p.spotlight_title || p.spotlight_story)) || data.find(p => p.spotlight_title || p.spotlight_story);
    const feature = document.getElementById("featuredSpotlight");
    if (spotlight && feature) {
      feature.hidden = false;
      feature.innerHTML = '<div class="spotlight-copy"><div class="section-label">FEATURED PARTNER SPOTLIGHT</div><span class="partner-tier">' + esc(spotlight.recognition_tier) + '</span><h3>' + esc(spotlight.spotlight_title || spotlight.organization_name) + '</h3><p>' + esc(spotlight.spotlight_story || spotlight.short_description) + '</p><b>' + esc(spotlight.organization_name) + '</b></div>';
    }
    const episodes = data.filter(p => p.episode_url && /^https:\/\//i.test(p.episode_url));
    const episodeBox = document.getElementById("spotlightEpisodes");
    if (episodes.length && episodeBox) episodeBox.innerHTML = episodes.map(p => '<article class="spotlight-episode-card"><span class="section-label">PARTNER CONVERSATION</span><h3>' + esc(p.organization_name) + '</h3><p>' + esc(p.spotlight_title || p.short_description) + '</p><a href="' + esc(p.episode_url) + '" target="_blank" rel="noopener noreferrer" data-episode="' + esc(p.id) + '">Watch or listen ↗</a></article>').join("");
    episodeBox?.querySelectorAll("[data-episode]").forEach(a => a.addEventListener("click", () => track("spotlight_click", a.dataset.episode)));
  }
  loadPartners();

  document.querySelectorAll("[data-type]").forEach(link => link.addEventListener("click", () => { if (typeSelect) typeSelect.value = link.dataset.type; }));
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Submitting inquiry…";
    const data = new FormData(form);
    const type = String(data.get("type") || "");
    const interest = /nonprofit|community/i.test(type) ? "events" : /media|creator/i.test(type) ? "creator" : /technology|production/i.test(type) ? "production" : /custom/i.test(type) ? "other" : "partnership";
    const websiteUrl = String(data.get("website") || "").trim();
    const message = "Partnership type: " + type + "\n\n" + String(data.get("message") || "").trim();
    const { data: result, error } = await sb.functions.invoke("partnership-application", {
      body: {
        name: String(data.get("name") || "").trim(),
        organization: String(data.get("organization") || "").trim(),
        email: String(data.get("email") || "").trim(),
        interest, message, website_url: websiteUrl,
        company_website: String(data.get("company_website") || "").trim()
      }
    });
    if (error || !result?.ok) {
      console.error("Partnership application submission failed:", error || result?.error);
      feedback.textContent = result?.error || "We couldn't submit the inquiry just now. Please try again or email crowrulesentertainment@gmail.com.";
      button.disabled = false;
      button.innerHTML = 'Submit partnership inquiry <span>↗</span>';
      return;
    }
    feedback.textContent = result.notification_sent === false ? "Your inquiry was saved, but the email alert could not be confirmed. Your application is in the administration center." : "Thank you. Your partnership inquiry has been received, saved and emailed to the CrowRules partnership team.";
    feedback.classList.add("success");
    form.reset();
    button.disabled = false;
    button.innerHTML = 'Submit partnership inquiry <span>↗</span>';
    track("application_submit");
  });

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll(".value-strip article,.opportunity-card,.process-steps article,.partner-form,.spotlight-episode-card").forEach(el => { el.classList.add("reveal"); observer.observe(el); });
  }
})();