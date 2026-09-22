// CrowRules Supabase Configuration
// Public client configuration only.
// NEVER put a Supabase service_role key in this file.

window.CROWRULES_SUPABASE_URL =
  "https://cevylpnoexugwgygvtgu.supabase.co";

window.CROWRULES_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

// Compatibility aliases used by older CrowRules pages.
window.SUPABASE_URL =
  window.CROWRULES_SUPABASE_URL;

window.supabaseUrl =
  window.CROWRULES_SUPABASE_URL;

window.SUPABASE_PUBLISHABLE_KEY =
  window.CROWRULES_SUPABASE_PUBLISHABLE_KEY;

// Optional legacy compatibility.
// Existing pages that still expect SUPABASE_ANON_KEY can use this.
window.SUPABASE_ANON_KEY =
  window.CROWRULES_SUPABASE_PUBLISHABLE_KEY;
