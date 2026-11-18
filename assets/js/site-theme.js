/* CrowRules Podcasting sitewide theme runtime.
 * Admin-selected themes are synchronized across every app page on this browser.
 * Presentation only: no authentication, database, or feature behavior.
 */
(() => {
  "use strict";
  const STORAGE_KEY = "crp_site_theme";
  const LEGACY_KEY = "crp_admin_theme";
  const THEMES = [{"id":"default","label":"Tacoma Nights · Default","icon":"🌃","desc":"Rain-slick Tacoma skyline, waterfront lights and deep Pacific Northwest blues","accent":"#9bdcff","glow":"rgba(75,155,220,.20)","panel":"rgba(7,15,28,.90)","ink":"#f0f7ff","muted":"#b7c6d8","photo":"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=85","hero":"https://commons.wikimedia.org/wiki/Special:FilePath/Tacoma_Narrows_Bridge_Panorama.jpg?width=2400"},{"id":"halloween","label":"Halloween Cinematic","icon":"🎃","desc":"Haunted woods, drifting ghosts, bats, eerie eyes and rolling moonlit fog","accent":"#ffb36b","glow":"rgba(255,105,38,.22)","panel":"rgba(24,11,12,.92)","ink":"#fff2e7","muted":"#d1b6a8","photo":"https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=2400&q=85","hero":"https://images.unsplash.com/photo-1475738198235-4b30fcf6a3b9?auto=format&fit=crop&w=2400&q=85"},{"id":"thanksgiving","label":"Thanksgiving · Harvest Cinematic","icon":"🦃","desc":"A premium harvest-night experience with ember gold, cranberry velvet, copper leaves and warm candlelight","accent":"#f2b45f","glow":"rgba(242,145,53,.30)","panel":"rgba(29,15,10,.94)","ink":"#fff5e8","muted":"#d9bda4","photo":"https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=2400&q=90","hero":"https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=90"},{
    "id": "christmas",
    "label": "Christmas · Winter Wonderland",
    "icon": "🎄",
    "desc": "Snow-dusted evergreens, glowing winter lights, midnight blue and festive cranberry",
    "accent": "#e8c77b",
    "glow": "rgba(55,190,157,.25)",
    "panel": "rgba(7,22,29,.94)",
    "ink": "#f5fbff",
    "muted": "#c2d4dc",
    "photo": "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=90",
    "hero": "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?auto=format&fit=crop&w=2400&q=90"
  } catch { return "original"; }
  };
  const applyTheme = id => {
    const theme = id === "original" ? original : getTheme(id);
    const root = document.documentElement;
    const active = theme.id !== "original";
    root.dataset.siteTheme = active ? theme.id : "";
    document.body.dataset.siteTheme = active ? theme.id : "";
    const vars = {
      "--cr-site-accent": theme.accent,
      "--cr-site-glow": theme.glow,
      "--cr-site-panel": theme.panel,
      "--cr-site-ink": theme.ink,
      "--cr-site-muted": theme.muted,
      "--cr-site-scene": theme.photo ? 'url("' + theme.photo + '")' : "none",
      "--cr-site-hero": theme.hero ? 'url("' + theme.hero + '")' : "none"
    };
    Object.entries(vars).forEach(([key, value]) => {
      if (active && value && value !== "none") root.style.setProperty(key, value);
      else root.style.removeProperty(key);
    });
  };
  const style = document.createElement("style");
  style.id = "cr-site-theme-styles";
  style.textContent = `
    html[data-site-theme]:not([data-site-theme=""]),body[data-site-theme]:not([data-site-theme=""]){color-scheme:dark}
    body[data-site-theme]:not([data-site-theme=""]){background-color:#120b08!important;background-image:linear-gradient(180deg,rgba(16,8,5,.70),rgba(8,7,7,.94)),var(--cr-site-scene)!important;background-position:center,center 38%!important;background-size:cover!important;background-attachment:fixed!important;color:var(--cr-site-ink,#fff5e8)!important}
    body[data-site-theme]:not([data-site-theme=""]) .topbar,body[data-site-theme]:not([data-site-theme=""]) .crp-nav{background:linear-gradient(100deg,var(--cr-site-panel),rgba(17,9,7,.97))!important;border-bottom:1px solid color-mix(in srgb,var(--cr-site-accent) 42%,transparent)!important;box-shadow:0 8px 34px rgba(0,0,0,.34)!important}
    body[data-site-theme]:not([data-site-theme=""]) .hero{background-image:linear-gradient(90deg,rgba(18,8,5,.94),rgba(18,8,5,.62) 55%,rgba(18,8,5,.18)),linear-gradient(0deg,#100907,transparent 48%),var(--cr-site-hero)!important;background-color:#180d08!important}
    body[data-site-theme]:not([data-site-theme=""]) .page-hero{background:radial-gradient(ellipse at 78% 0%,color-mix(in srgb,var(--cr-site-accent) 24%,transparent),transparent 46%),linear-gradient(135deg,var(--cr-site-panel),rgba(14,9,8,.96))!important}
    body[data-site-theme]:not([data-site-theme=""]) .card,body[data-site-theme]:not([data-site-theme=""]) .panel,body[data-site-theme]:not([data-site-theme=""]) .stat,body[data-site-theme]:not([data-site-theme=""]) .tile,body[data-site-theme]:not([data-site-theme=""]) .sidebar,body[data-site-theme]:not([data-site-theme=""]) .auth-card{background:linear-gradient(145deg,var(--cr-site-panel),rgba(16,10,8,.96))!important;border-color:color-mix(in srgb,var(--cr-site-accent) 28%,rgba(255,255,255,.08))!important;box-shadow:0 14px 36px rgba(0,0,0,.24)!important}
    body[data-site-theme]:not([data-site-theme=""]) .card:hover,body[data-site-theme]:not([data-site-theme=""]) .ranking-tile:hover{border-color:color-mix(in srgb,var(--cr-site-accent) 65%,transparent)!important;box-shadow:0 16px 38px var(--cr-site-glow)!important}
    body[data-site-theme]:not([data-site-theme=""]) .eyebrow,body[data-site-theme]:not([data-site-theme=""]) .hero h1 em,body[data-site-theme]:not([data-site-theme=""]) .section-head h2,body[data-site-theme]:not([data-site-theme=""]) .page-title,body[data-site-theme]:not([data-site-theme=""]) .rank-num,body[data-site-theme]:not([data-site-theme=""]) .crp-eyebrow,body[data-site-theme]:not([data-site-theme=""]) .crp-hero h1 em{color:var(--cr-site-accent)!important}
    body[data-site-theme]:not([data-site-theme=""]) .hero h1 em{background:none!important;-webkit-text-fill-color:var(--cr-site-accent)!important}
    body[data-site-theme]:not([data-site-theme=""]) .btn:not(.secondary),body[data-site-theme]:not([data-site-theme=""]) button:not(.secondary):not(.menu-toggle),body[data-site-theme]:not([data-site-theme=""]) .crp-button-red{background:linear-gradient(135deg,color-mix(in srgb,var(--cr-site-accent) 60%,#71301c),var(--cr-site-accent))!important;border-color:var(--cr-site-accent)!important;color:#211108!important;box-shadow:0 5px 18px var(--cr-site-glow)!important}
    body[data-site-theme]:not([data-site-theme=""]) .btn.secondary,body[data-site-theme]:not([data-site-theme=""]) button.secondary{background:rgba(93,43,27,.28)!important;border-color:color-mix(in srgb,var(--cr-site-accent) 40%,transparent)!important;color:var(--cr-site-ink)!important}
    body[data-site-theme]:not([data-site-theme=""]) input,body[data-site-theme]:not([data-site-theme=""]) select,body[data-site-theme]:not([data-site-theme=""]) textarea{background:rgba(16,9,7,.88)!important;border-color:color-mix(in srgb,var(--cr-site-accent) 30%,transparent)!important;color:var(--cr-site-ink)!important}
    body[data-site-theme]:not([data-site-theme=""]) .muted,body[data-site-theme]:not([data-site-theme=""]) .card p,body[data-site-theme]:not([data-site-theme=""]) .page-hero p{color:var(--cr-site-muted)!important}
    body[data-site-theme]:not([data-site-theme=""]) .footer{border-top-color:color-mix(in srgb,var(--cr-site-accent) 28%,transparent)!important}
    body[data-site-theme="christmas"]{background-color:#07141c!important;background-image:radial-gradient(ellipse at 50% -10%,rgba(95,209,177,.22),transparent 48%),linear-gradient(180deg,rgba(3,14,22,.54),rgba(3,10,17,.94)),var(--cr-site-scene)!important}
    body[data-site-theme="christmas"] .topbar,body[data-site-theme="christmas"] .crp-nav{background:linear-gradient(100deg,rgba(5,25,31,.97),rgba(13,43,43,.94),rgba(8,20,31,.98))!important;border-bottom:1px solid rgba(232,199,123,.38)!important}
    body[data-site-theme="christmas"] .hero{background-image:linear-gradient(90deg,rgba(4,18,26,.91),rgba(4,18,26,.52) 56%,rgba(4,18,26,.12)),linear-gradient(0deg,#06131b,transparent 52%),var(--cr-site-hero)!important}
    body[data-site-theme="christmas"] .card,body[data-site-theme="christmas"] .panel,body[data-site-theme="christmas"] .stat,body[data-site-theme="christmas"] .tile,body[data-site-theme="christmas"] .auth-card{border-color:rgba(142,218,197,.24)!important;box-shadow:0 16px 40px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.06)!important}
    body[data-site-theme="christmas"] .eyebrow,body[data-site-theme="christmas"] .section-head h2,body[data-site-theme="christmas"] .page-title,body[data-site-theme="christmas"] .rank-num{color:#e8c77b!important}
    body[data-site-theme="christmas"] .btn:not(.secondary),body[data-site-theme="christmas"] button:not(.secondary):not(.menu-toggle){background:linear-gradient(120deg,#17634f,#249b79 58%,#e8c77b)!important;border-color:rgba(232,199,123,.62)!important;color:#061b19!important}
    body[data-site-theme="christmas"] .btn.secondary,body[data-site-theme="christmas"] button.secondary{background:rgba(17,65,58,.35)!important;border-color:rgba(142,218,197,.34)!important;color:#effff9!important}
    body[data-site-theme="christmas"] input,body[data-site-theme="christmas"] select,body[data-site-theme="christmas"] textarea{background:rgba(5,20,28,.92)!important;border-color:rgba(142,218,197,.3)!important}
    body[data-site-theme="christmas"] .card,body[data-site-theme="christmas"] .panel,body[data-site-theme="christmas"] .tile{position:relative;overflow:hidden}
    body[data-site-theme="christmas"] .card:after,body[data-site-theme="christmas"] .panel:after,body[data-site-theme="christmas"] .tile:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.07),transparent 38%,rgba(44,139,111,.08))}
    body[data-site-theme="christmas"] ::selection{background:#e8c77b;color:#10221f}
    body[data-site-theme="thanksgiving"] .card,body[data-site-theme="thanksgiving"] .panel,body[data-site-theme="thanksgiving"] .stat,body[data-site-theme="thanksgiving"] .tile{position:relative;overflow:hidden;border-radius:16px!important}
    body[data-site-theme="thanksgiving"] .card:after,body[data-site-theme="thanksgiving"] .panel:after,body[data-site-theme="thanksgiving"] .tile:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(130deg,rgba(255,213,153,.055),transparent 42%,rgba(129,48,22,.09))}
    body[data-site-theme="thanksgiving"] .rankings-hero-backdrop{filter:saturate(.82) sepia(.12)}
    body[data-site-theme="thanksgiving"] .rankings-season-tag,body[data-site-theme="thanksgiving"] .rankings-featured-copy .eyebrow{background:linear-gradient(120deg,#7c2b20,#c87537)!important;color:#fff3df!important;border-color:#d79a55!important}
    body[data-site-theme="thanksgiving"] .ranking-tile{background:linear-gradient(145deg,#321b13,#17100d)!important}
    body[data-site-theme="thanksgiving"] .crp-member-card{background:linear-gradient(145deg,#321b13,#17100d)!important;border-color:rgba(242,180,95,.24)!important}
    body[data-site-theme="thanksgiving"] ::selection{background:#c87537;color:#160b07}
    @media(max-width:760px){body[data-site-theme]:not([data-site-theme=""]){background-attachment:scroll!important}}
    @media(prefers-reduced-motion:reduce){body[data-site-theme] *{scroll-behavior:auto!important;transition:none!important;animation-duration:.01ms!important}}
  `;
  document.head.appendChild(style);
  const refresh = () => applyTheme(readTheme());
  refresh();
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_KEY) refresh();
  });
  window.addEventListener("cr:site-theme-change", event => applyTheme(event.detail || readTheme()));
})();
