/* CrowRules Podcasting admin theme selector.
 * Uses the premade CrowRules seasonal/cinematic theme catalog.
 * Presentation only: no auth, Supabase, or feature logic.
 */
(() => {
  "use strict";
  if (document.body.dataset.page !== "admin") return;

  const STORAGE_KEY = "crp_site_theme";
  const THEMES = [
  {
    "id": "default",
    "label": "Tacoma Nights · Default",
    "icon": "🌃",
    "desc": "Rain-slick Tacoma skyline, waterfront lights and deep Pacific Northwest blues",
    "accent": "#9bdcff",
    "glow": "rgba(75,155,220,.20)",
    "panel": "rgba(7,15,28,.90)",
    "ink": "#f0f7ff",
    "muted": "#b7c6d8",
    "photo": "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://commons.wikimedia.org/wiki/Special:FilePath/Tacoma_Narrows_Bridge_Panorama.jpg?width=2400"
  },
  {
    "id": "halloween",
    "label": "Halloween Cinematic",
    "icon": "🎃",
    "desc": "Haunted woods, drifting ghosts, bats, eerie eyes and rolling moonlit fog",
    "accent": "#ffb36b",
    "glow": "rgba(255,105,38,.22)",
    "panel": "rgba(24,11,12,.92)",
    "ink": "#fff2e7",
    "muted": "#d1b6a8",
    "photo": "https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1475738198235-4b30fcf6a3b9?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "thanksgiving",
    "label": "Thanksgiving · Harvest Cinematic",
    "icon": "🦃",
    "desc": "A premium harvest-night experience with ember gold, cranberry velvet, copper leaves and warm candlelight",
    "accent": "#f2b45f",
    "glow": "rgba(242,145,53,.30)",
    "panel": "rgba(29,15,10,.94)",
    "ink": "#fff5e8",
    "muted": "#d9bda4",
    "photo": "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=2400&q=90",
    "hero": "https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=90"
  },
  {
    "id": "christmas",
    "label": "Christmas · Cinematic Christmas Eve",
    "icon": "🎄",
    "desc": "Photoreal snowy village streets, towering evergreens, glowing cabin windows and festive lights beneath a midnight winter sky",
    "accent": "#f1d58b",
    "glow": "rgba(82,204,177,.30)",
    "panel": "rgba(5,19,29,.94)",
    "ink": "#f7fbff",
    "muted": "#c6d8e2",
    "photo": "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=92",
    "hero": "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=2400&q=92"
  },
  {
    "id": "newyear",
    "label": "New Year’s Eve Cinematic",
    "icon": "🎆",
    "desc": "A midnight city skyline, sparkling fireworks and elegant gold-violet light",
    "accent": "#f8d98b",
    "glow": "rgba(119,121,255,.24)",
    "panel": "rgba(9,11,27,.93)",
    "ink": "#fff9e9",
    "muted": "#c7c9df",
    "photo": "https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "new-years-day",
    "label": "New Year’s Day · Fresh Start",
    "icon": "🌅",
    "desc": "A luminous first sunrise, champagne-gold light and a clean new-year horizon",
    "accent": "#f6d78b",
    "glow": "rgba(255,205,96,.24)",
    "panel": "rgba(14,17,31,.94)",
    "ink": "#fff9ec",
    "muted": "#d2c8ad",
    "photo": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "st-patricks-day",
    "label": "St. Patrick’s Day · Emerald Celebration",
    "icon": "☘️",
    "desc": "Emerald greens, shamrocks, soft golden glimmers and Irish spring atmosphere",
    "accent": "#7ff0a3",
    "glow": "rgba(34,190,94,.24)",
    "panel": "rgba(5,28,18,.94)",
    "ink": "#effff3",
    "muted": "#b9d8c2",
    "photo": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "april-fools-day",
    "label": "April Fools’ Day · Playful Chaos",
    "icon": "🤡",
    "desc": "Colorful confetti, playful surprises, bright accents and a mischievous party mood",
    "accent": "#ffdc62",
    "glow": "rgba(255,82,145,.23)",
    "panel": "rgba(24,12,35,.94)",
    "ink": "#fff9f1",
    "muted": "#d8c6e5",
    "photo": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "memorial-day",
    "label": "Memorial Day · Honor & Remembrance",
    "icon": "🇺🇸",
    "desc": "A respectful tribute with deep navy, quiet red-white-blue accents and candlelit remembrance",
    "accent": "#c6d8f4",
    "glow": "rgba(86,126,198,.20)",
    "panel": "rgba(7,14,29,.95)",
    "ink": "#f4f7ff",
    "muted": "#bac6da",
    "photo": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "labor-day",
    "label": "Labor Day · Celebrate the People Who Build",
    "icon": "🛠️",
    "desc": "Industrial steel, warm copper light and a tribute to workers and community builders",
    "accent": "#f3b477",
    "glow": "rgba(225,124,57,.22)",
    "panel": "rgba(19,20,23,.95)",
    "ink": "#fff7ed",
    "muted": "#c9c3bc",
    "photo": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "veterans-day",
    "label": "Veterans Day · Service & Gratitude",
    "icon": "🎖️",
    "desc": "Dignified midnight blue, muted flag colors and a calm atmosphere of gratitude",
    "accent": "#c4d4e8",
    "glow": "rgba(91,126,164,.22)",
    "panel": "rgba(9,18,29,.95)",
    "ink": "#f3f7fb",
    "muted": "#bac9d7",
    "photo": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "black-friday",
    "label": "Black Friday · Midnight Shopping",
    "icon": "🛍️",
    "desc": "Sleek black glass, electric gold highlights, neon storefront glow and city-night energy",
    "accent": "#ffd36b",
    "glow": "rgba(255,190,54,.24)",
    "panel": "rgba(10,10,13,.96)",
    "ink": "#fff9e8",
    "muted": "#c9c3b4",
    "photo": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "kwanzaa",
    "label": "Kwanzaa · Unity & Heritage",
    "icon": "🕯️",
    "desc": "Black, red and green with warm candlelight celebrating unity, purpose and community",
    "accent": "#f4c45f",
    "glow": "rgba(196,46,50,.24)",
    "panel": "rgba(18,12,13,.96)",
    "ink": "#fff6e8",
    "muted": "#d5c3b3",
    "photo": "https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "groundhog-day",
    "label": "Groundhog Day · Winter Watch",
    "icon": "🐿️",
    "desc": "A cozy winter dawn, frosted branches, a curious groundhog and the promise of spring",
    "accent": "#c9d9e8",
    "glow": "rgba(155,190,220,.23)",
    "panel": "rgba(13,20,31,.94)",
    "ink": "#f2f7ff",
    "muted": "#bdcbd9",
    "photo": "https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1457269449834-928af64c684d?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "spring",
    "label": "Spring · Bloom & Renewal",
    "icon": "🌷",
    "desc": "Fresh blossoms, soft rain, new leaves and a bright Pacific Northwest spring",
    "accent": "#a7edbd",
    "glow": "rgba(105,220,147,.22)",
    "panel": "rgba(8,25,22,.92)",
    "ink": "#f0fff6",
    "muted": "#bed9cc",
    "photo": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "summer",
    "label": "Summer · Golden Evenings",
    "icon": "☀️",
    "desc": "Golden-hour sunshine, warm skies, vivid greenery and long summer evenings",
    "accent": "#ffd479",
    "glow": "rgba(255,183,65,.24)",
    "panel": "rgba(24,20,11,.91)",
    "ink": "#fff9ed",
    "muted": "#ded0b2",
    "photo": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "fall",
    "label": "Fall · Pacific Northwest Autumn",
    "icon": "🍁",
    "desc": "Copper leaves, misty forests, amber light and cozy autumn atmosphere",
    "accent": "#f4b36f",
    "glow": "rgba(214,104,43,.23)",
    "panel": "rgba(27,16,11,.93)",
    "ink": "#fff4e7",
    "muted": "#d8bea7",
    "photo": "https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "winter",
    "label": "Winter · Frost & Northern Lights",
    "icon": "❄️",
    "desc": "Snowy evergreens, icy blue light, drifting snow and a tranquil winter night",
    "accent": "#a9dfff",
    "glow": "rgba(99,181,237,.23)",
    "panel": "rgba(7,17,30,.94)",
    "ink": "#f0f9ff",
    "muted": "#bbd0df",
    "photo": "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "valentines",
    "label": "Valentine’s Day · Love & Connection",
    "icon": "💗",
    "desc": "Crimson roses, candlelit warmth and romantic rose-gold highlights",
    "accent": "#ff8ba7",
    "glow": "rgba(244,65,112,.25)",
    "panel": "rgba(35,10,22,.94)",
    "ink": "#fff0f4",
    "muted": "#e0b9c7",
    "photo": "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "easter",
    "label": "Easter · Spring Awakening",
    "icon": "🌷",
    "desc": "Spring blossoms, fresh greenery and soft pastel sunrise colors",
    "accent": "#c7a6ff",
    "glow": "rgba(170,130,255,.23)",
    "panel": "rgba(18,22,35,.93)",
    "ink": "#f8f4ff",
    "muted": "#c8c6df",
    "photo": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "independence-day",
    "label": "Independence Day · Stars & Stripes",
    "icon": "🇺🇸",
    "desc": "Midnight-blue skies, patriotic red-white-blue light and celebration",
    "accent": "#7db6ff",
    "glow": "rgba(54,112,255,.24)",
    "panel": "rgba(7,16,35,.94)",
    "ink": "#f4f7ff",
    "muted": "#b9c8e4",
    "photo": "https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "mothers-day",
    "label": "Mother’s Day · A Celebration of Care",
    "icon": "🌸",
    "desc": "Blush florals, peonies and warm golden sunlight",
    "accent": "#f2a3cb",
    "glow": "rgba(229,111,177,.22)",
    "panel": "rgba(31,14,29,.94)",
    "ink": "#fff2fa",
    "muted": "#dfbfd4",
    "photo": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "fathers-day",
    "label": "Father’s Day · Legacy & Strength",
    "icon": "🌄",
    "desc": "Mountain horizons, deep steel blues and copper sunset warmth",
    "accent": "#8dc7e8",
    "glow": "rgba(80,155,205,.22)",
    "panel": "rgba(10,20,30,.94)",
    "ink": "#f1f8fc",
    "muted": "#b8cad5",
    "photo": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85"
  },
  {
    "id": "juneteenth",
    "label": "Juneteenth · Freedom & Heritage",
    "icon": "✊🏿",
    "desc": "Respectful heritage palette celebrating freedom, history and community",
    "accent": "#f0c15b",
    "glow": "rgba(202,48,55,.23)",
    "panel": "rgba(20,12,13,.95)",
    "ink": "#fff6e8",
    "muted": "#d6c2b0",
    "photo": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=2400&q=85",
    "hero": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=2400&q=85"
  }
];
  const original = { id: "original", label: "Original · Site default", icon: "◈", desc: "Restore the standard admin appearance." };
  const getTheme = id => THEMES.find(theme => theme.id === id) || original;
  const readTheme = () => {
    try {
      const value = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("crp_admin_theme") || "original";
      return value === "original" || THEMES.some(theme => theme.id === value) ? value : "original";
    } catch { return "original"; }
  };
  const applyTheme = (id, persist = true) => {
    const theme = id === "original" ? original : getTheme(id);
    const selected = theme.id;
    const root = document.documentElement;
    root.dataset.adminTheme = selected === "original" ? "" : selected;
    document.body.dataset.adminTheme = selected === "original" ? "" : selected;
    root.dataset.siteTheme = selected === "original" ? "" : selected;
    document.body.dataset.siteTheme = selected === "original" ? "" : selected;
    if (selected === "original") {
      ["--cr-admin-accent","--cr-admin-glow","--cr-admin-panel","--cr-admin-ink","--cr-admin-muted","--cr-admin-scene"].forEach(key => root.style.removeProperty(key));
    } else {
      root.style.setProperty("--cr-admin-accent", theme.accent);
      root.style.setProperty("--cr-admin-glow", theme.glow);
      root.style.setProperty("--cr-admin-panel", theme.panel);
      root.style.setProperty("--cr-admin-ink", theme.ink);
      root.style.setProperty("--cr-admin-muted", theme.muted);
      root.style.setProperty("--cr-admin-scene", 'url("' + theme.photo + '")');
    }
    const select = document.getElementById("crAdminThemeSelect");
    const status = document.getElementById("crAdminThemeStatus");
    if (select) select.value = selected;
    if (status) status.textContent = selected === "original" ? "Original CrowRules Podcasting appearance is active." : theme.icon + " " + theme.label + " is active across CrowRules Podcasting.";
    if (persist) { try { localStorage.setItem(STORAGE_KEY, selected); localStorage.setItem("crp_admin_theme", selected); } catch {} }
    window.dispatchEvent(new CustomEvent("cr:site-theme-change", { detail: selected }));
  };

  const style = document.createElement("style");
  style.id = "cr-admin-theme-switcher-styles";
  style.textContent = `
    #crAdminThemeControl{position:fixed;z-index:10000;top:14px;right:18px;font:inherit}
    #crAdminThemeToggle{display:flex;align-items:center;gap:9px;min-height:40px;padding:9px 13px;border:1px solid #ffffff25;border-radius:12px;background:#111722;color:#fff;font-size:12px;font-weight:800;box-shadow:0 8px 24px #0005;cursor:pointer}
    #crAdminThemeToggle:hover{border-color:var(--cr-admin-accent,#d8ad61)}
    #crAdminThemePanel{position:absolute;top:48px;right:0;width:min(350px,calc(100vw - 28px));max-height:min(78vh,650px);overflow:auto;padding:16px;border:1px solid #ffffff22;border-radius:15px;background:#111722;color:#f7f7f7;box-shadow:0 18px 48px #0009}
    #crAdminThemePanel[hidden]{display:none}
    #crAdminThemePanel label{display:block;margin-bottom:8px;font-size:11px;font-weight:850;letter-spacing:.08em;color:#c7ccd5}
    #crAdminThemeSelect{width:100%;min-height:42px;padding:9px 11px;border:1px solid #ffffff25;border-radius:9px;background:#090d14;color:#fff;font:inherit}
    #crAdminThemeStatus{display:block;margin-top:10px;color:#b9c0cc;font-size:11px;line-height:1.5}
    #crAdminThemeRestore{width:100%;margin-top:12px;min-height:38px;border:1px solid #ffffff25;border-radius:9px;background:#ffffff0b;color:#fff;font:700 12px inherit;cursor:pointer}
    #crAdminThemeRestore:hover{border-color:var(--cr-admin-accent,#d8ad61);color:var(--cr-admin-accent,#f3d49a)}
    body[data-admin-theme]:not([data-admin-theme=""]){background-color:#080a0e!important;background-image:linear-gradient(180deg,rgba(5,8,13,.58),rgba(5,8,13,.88)),var(--cr-admin-scene)!important;background-position:center,center 42%!important;background-size:cover!important;background-attachment:fixed!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .topbar{border-bottom-color:color-mix(in srgb,var(--cr-admin-accent) 42%,transparent)!important;background:linear-gradient(105deg,var(--cr-admin-panel),rgba(8,10,14,.96))!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .admin-module,body[data-admin-theme]:not([data-admin-theme=""]) .panel,body[data-admin-theme]:not([data-admin-theme=""]) .admin-card,body[data-admin-theme]:not([data-admin-theme=""]) .admin-stat-card{border-color:color-mix(in srgb,var(--cr-admin-accent) 30%,transparent)!important;background:linear-gradient(145deg,var(--cr-admin-panel),rgba(9,14,21,.94))!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .admin-module-head h2,body[data-admin-theme]:not([data-admin-theme=""]) .admin-module-head h3,body[data-admin-theme]:not([data-admin-theme=""]) .section-head h2,body[data-admin-theme]:not([data-admin-theme=""]) .section-head h3,body[data-admin-theme]:not([data-admin-theme=""]) .admin-kicker,body[data-admin-theme]:not([data-admin-theme=""]) .eyebrow{color:var(--cr-admin-accent)!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .btn:not(.secondary),body[data-admin-theme]:not([data-admin-theme=""]) button.primary{background:linear-gradient(135deg,color-mix(in srgb,var(--cr-admin-accent) 75%,#111),var(--cr-admin-accent))!important;border-color:var(--cr-admin-accent)!important;color:#101116!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .admin-table th{background:var(--cr-admin-panel)!important;color:var(--cr-admin-accent)!important}
    body[data-admin-theme]:not([data-admin-theme=""]) .admin-table tr:hover{background:color-mix(in srgb,var(--cr-admin-accent) 10%,transparent)!important}
    body[data-admin-theme]:not([data-admin-theme=""]) #crAdminThemeToggle{border-color:color-mix(in srgb,var(--cr-admin-accent) 55%,transparent);background:var(--cr-admin-panel)}
    @media(max-width:760px){#crAdminThemeControl{top:9px;right:10px}#crAdminThemeToggle{min-height:36px;padding:8px 10px;font-size:11px}}

    body[data-admin-theme="christmas"]{background-color:#07141c!important;background-image:radial-gradient(ellipse at 50% 0%,rgba(95,209,177,.20),transparent 48%),linear-gradient(180deg,rgba(3,14,22,.48),rgba(3,10,17,.90)),var(--cr-admin-scene)!important}
    body[data-admin-theme="christmas"] .topbar{background:linear-gradient(100deg,rgba(5,25,31,.98),rgba(13,43,43,.94),rgba(8,20,31,.98))!important;border-bottom:1px solid rgba(232,199,123,.42)!important}
    body[data-admin-theme="christmas"] .admin-module,body[data-admin-theme="christmas"] .panel,body[data-admin-theme="christmas"] .admin-card,body[data-admin-theme="christmas"] .admin-stat-card{border:1px solid rgba(142,218,197,.27)!important;border-radius:18px!important;box-shadow:0 16px 42px rgba(0,0,0,.36),inset 0 1px rgba(255,255,255,.06)!important}
    body[data-admin-theme="christmas"] .admin-module-head h2,body[data-admin-theme="christmas"] .admin-module-head h3,body[data-admin-theme="christmas"] .section-head h2,body[data-admin-theme="christmas"] .admin-kicker{color:#e8c77b!important}
    body[data-admin-theme="christmas"] .btn:not(.secondary),body[data-admin-theme="christmas"] button.primary{background:linear-gradient(120deg,#17634f,#249b79 58%,#e8c77b)!important;border:1px solid rgba(232,199,123,.62)!important;color:#061b19!important;box-shadow:0 5px 18px rgba(36,155,121,.22)!important}
    body[data-admin-theme="christmas"] .btn.secondary,body[data-admin-theme="christmas"] button.secondary{border-color:rgba(142,218,197,.34)!important;background:rgba(17,65,58,.35)!important;color:#effff9!important}
    body[data-admin-theme="christmas"] input,body[data-admin-theme="christmas"] select,body[data-admin-theme="christmas"] textarea{border-color:rgba(142,218,197,.3)!important;background:rgba(5,20,28,.92)!important;color:#f5fbff!important}
    body[data-admin-theme="christmas"] .admin-table th{background:linear-gradient(90deg,rgba(12,66,54,.92),rgba(8,36,43,.95))!important;color:#e8c77b!important}
    body[data-admin-theme="christmas"] .admin-module-head,body[data-admin-theme="christmas"] .section-head{border-bottom:1px solid rgba(232,199,123,.20)!important}
    body[data-admin-theme="thanksgiving"]{--cr-thanksgiving-ember:#9b3f1e;--cr-thanksgiving-cranberry:#6e1e28;--cr-thanksgiving-copper:#c87537}
    body[data-admin-theme="thanksgiving"]::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 50% 0%,rgba(255,181,91,.20),transparent 48%),linear-gradient(180deg,rgba(20,8,5,.24),rgba(10,6,5,.82))}
    body[data-admin-theme="thanksgiving"] .topbar{background:linear-gradient(100deg,rgba(35,16,10,.97),rgba(72,29,15,.88),rgba(24,13,10,.97))!important;box-shadow:0 8px 36px rgba(0,0,0,.36),inset 0 -1px rgba(242,180,95,.38)!important}
    body[data-admin-theme="thanksgiving"] .admin-module,body[data-admin-theme="thanksgiving"] .panel,body[data-admin-theme="thanksgiving"] .admin-card,body[data-admin-theme="thanksgiving"] .admin-stat-card{position:relative;overflow:hidden;border:1px solid rgba(242,180,95,.34)!important;border-radius:18px!important;box-shadow:0 16px 42px rgba(0,0,0,.34),inset 0 1px rgba(255,239,211,.06)!important}
    body[data-admin-theme="thanksgiving"] .admin-module::after,body[data-admin-theme="thanksgiving"] .panel::after,body[data-admin-theme="thanksgiving"] .admin-card::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(130deg,rgba(255,206,132,.07),transparent 38%,rgba(133,54,24,.08))}
    body[data-admin-theme="thanksgiving"] h1,body[data-admin-theme="thanksgiving"] h2,body[data-admin-theme="thanksgiving"] h3{text-shadow:0 2px 18px rgba(242,145,53,.16)}
    body[data-admin-theme="thanksgiving"] .admin-module-head,body[data-admin-theme="thanksgiving"] .section-head{border-bottom:1px solid rgba(242,180,95,.20)!important}
    body[data-admin-theme="thanksgiving"] .btn:not(.secondary),body[data-admin-theme="thanksgiving"] button.primary{background:linear-gradient(135deg,#8e351c,#c87537 55%,#f2b45f)!important;border:1px solid rgba(255,215,157,.55)!important;color:#1b100b!important;box-shadow:0 5px 18px rgba(173,75,27,.24)!important}
    body[data-admin-theme="thanksgiving"] .btn.secondary,body[data-admin-theme="thanksgiving"] button.secondary{border-color:rgba(242,180,95,.40)!important;background:rgba(104,45,28,.30)!important;color:#ffdfb8!important}
    body[data-admin-theme="thanksgiving"] input,body[data-admin-theme="thanksgiving"] select,body[data-admin-theme="thanksgiving"] textarea{border-color:rgba(242,180,95,.28)!important;background:rgba(18,10,8,.88)!important;color:#fff5e8!important}
    body[data-admin-theme="thanksgiving"] .admin-table th{background:linear-gradient(90deg,rgba(111,43,24,.78),rgba(75,32,21,.88))!important;color:#ffd18a!important}
    body[data-admin-theme="thanksgiving"] .admin-table td{border-color:rgba(242,180,95,.12)!important}
    body[data-admin-theme="thanksgiving"] a{text-decoration-color:rgba(242,180,95,.38);text-underline-offset:3px}
    body[data-admin-theme="thanksgiving"] ::selection{background:#c87537;color:#160b07}
    @media(max-width:760px){body[data-admin-theme="thanksgiving"] .admin-module,body[data-admin-theme="thanksgiving"] .panel,body[data-admin-theme="thanksgiving"] .admin-card{border-radius:14px!important}}
    @media(prefers-reduced-motion:no-preference){body[data-admin-theme="thanksgiving"] .admin-card,body[data-admin-theme="thanksgiving"] .admin-stat-card{transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}body[data-admin-theme="thanksgiving"] .admin-card:hover,body[data-admin-theme="thanksgiving"] .admin-stat-card:hover{transform:translateY(-2px);border-color:rgba(242,180,95,.62)!important;box-shadow:0 20px 46px rgba(0,0,0,.40),0 0 22px rgba(242,145,53,.10)!important}}
    @media(prefers-reduced-motion:reduce){#crAdminThemePanel *{transition:none!important}}
  `;
  document.head.appendChild(style);

  const mount = () => {
    if (document.getElementById("crAdminThemeControl")) return;
    const root = document.createElement("div");
    root.id = "crAdminThemeControl";
    root.innerHTML = `
      <button id="crAdminThemeToggle" type="button" aria-expanded="false" aria-controls="crAdminThemePanel">🎨 <span>Site theme</span></button>
      <section id="crAdminThemePanel" hidden aria-label="Sitewide theme settings">
        <label for="crAdminThemeSelect">PREMADE CROWRULES THEMES</label>
        <select id="crAdminThemeSelect">
          <option value="original">◈ Original · Site default</option>
          ${THEMES.map(theme => '<option value="' + theme.id + '">' + theme.icon + ' ' + theme.label + '</option>').join("")}
        </select>
        <small id="crAdminThemeStatus" role="status" aria-live="polite"></small>
        <button id="crAdminThemeRestore" type="button">↶ Restore original theme</button>
      </section>`;
    document.body.appendChild(root);
    const toggle = document.getElementById("crAdminThemeToggle");
    const panel = document.getElementById("crAdminThemePanel");
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.getElementById("crAdminThemeSelect").addEventListener("change", event => applyTheme(event.target.value));
    document.getElementById("crAdminThemeRestore").addEventListener("click", () => {
      applyTheme("original");
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    applyTheme(readTheme(), false);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
