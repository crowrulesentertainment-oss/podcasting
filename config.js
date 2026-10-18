/* CrowRules Podcasting public browser configuration.
 * Publishable/anon key only — never place a service_role or secret key here.
 */
window.CROW_CONFIG = Object.assign({}, window.CROW_CONFIG || {}, {
  supabaseUrl: "https://cevylpnoexugwgygvtgu.supabase.co",
  supabaseKey: "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
  logoUrl: "https://crowrulesentertainment-oss.github.io/podcasting/images/logo.png",
  launchAt: "2027-01-01T08:00:00Z"
});

/* Shared navigation is loaded on every page that includes config.js.
 * The script enhances existing menus and leaves page-specific links intact.
 */
(function () {
  "use strict";
  var script = document.createElement("script");
  script.src = "https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js";
  script.defer = true;
  script.onerror = function () {
    console.warn("[CrowRules] Shared navigation enhancement could not be loaded.");
  };
  document.head.appendChild(script);
})();
