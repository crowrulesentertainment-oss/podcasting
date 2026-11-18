(() => {
  "use strict";
  if (document.body.dataset.page !== "admin") return;

  const STORAGE_KEY = "crp_admin_theme";
  const THEMES = {
    original: { label: "Original", description: "Return to the standard CrowRules admin appearance." },
    thanksgiving: { label: "Thanksgiving", description: "A warm autumn look for the holiday season." }
  };

  const readTheme = () => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return Object.prototype.hasOwnProperty.call(THEMES, value) ? value : "original";
    } catch {
      return "original";
    }
  };

  const applyTheme = (theme, persist = true) => {
    const selected = Object.prototype.hasOwnProperty.call(THEMES, theme) ? theme : "original";
    document.documentElement.dataset.adminTheme = selected === "original" ? "" : selected;
    document.body.dataset.adminTheme = selected === "original" ? "" : selected;
    const select = document.getElementById("crAdminThemeSelect");
    const status = document.getElementById("crAdminThemeStatus");
    if (select) select.value = selected;
    if (status) status.textContent = selected === "original" ? "Original theme is active." : "Thanksgiving theme is active. Only this admin view is changed.";
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, selected); } catch {}
    }
  };

  const style = document.createElement("style");
  style.id = "cr-admin-theme-switcher-styles";
  style.textContent = `
    #crAdminThemeControl{position:fixed;z-index:10000;top:14px;right:18px;font:inherit}
    #crAdminThemeToggle{display:flex;align-items:center;gap:9px;min-height:40px;padding:9px 13px;border:1px solid #ffffff25;border-radius:12px;background:#111722;color:#fff;font-size:12px;font-weight:800;box-shadow:0 8px 24px #0005;cursor:pointer}
    #crAdminThemeToggle:hover{border-color:#d8ad61}
    #crAdminThemePanel{position:absolute;top:48px;right:0;width:min(310px,calc(100vw - 28px));padding:16px;border:1px solid #ffffff22;border-radius:15px;background:#111722;color:#f7f7f7;box-shadow:0 18px 48px #0009}
    #crAdminThemePanel[hidden]{display:none}
    #crAdminThemePanel label{display:block;margin-bottom:8px;font-size:11px;font-weight:850;letter-spacing:.08em;color:#c7ccd5}
    #crAdminThemeSelect{width:100%;min-height:42px;padding:9px 11px;border:1px solid #ffffff25;border-radius:9px;background:#090d14;color:#fff;font:inherit}
    #crAdminThemeStatus{display:block;margin-top:10px;color:#b9c0cc;font-size:11px;line-height:1.5}
    #crAdminThemeRestore{width:100%;margin-top:12px;min-height:38px;border:1px solid #ffffff25;border-radius:9px;background:#ffffff0b;color:#fff;font:700 12px inherit;cursor:pointer}
    #crAdminThemeRestore:hover{border-color:#d8ad61;color:#f3d49a}
    @media(max-width:760px){#crAdminThemeControl{top:9px;right:10px}#crAdminThemeToggle{min-height:36px;padding:8px 10px;font-size:11px}}
    html[data-admin-theme="thanksgiving"],body[data-admin-theme="thanksgiving"]{--cr-admin-autumn:#d49a4a;--cr-admin-autumn-soft:#f0c985;--cr-admin-autumn-deep:#382719}
    body[data-admin-theme="thanksgiving"]{background-color:#100e0b;background-image:radial-gradient(ellipse at 12% 0%,#8a542b35,transparent 34%),radial-gradient(ellipse at 92% 12%,#b17a3430,transparent 30%)}
    body[data-admin-theme="thanksgiving"] .topbar{border-bottom-color:#a9783b66;background:linear-gradient(105deg,#17120d,#24190f 58%,#17120d)}
    body[data-admin-theme="thanksgiving"] .topbar .nav-group>summary:after{color:#e5b66f}
    body[data-admin-theme="thanksgiving"] .topbar .nav-group>summary:hover,body[data-admin-theme="thanksgiving"] .topbar .nav-group.has-active>summary{background:#d49a4a20;color:#ffe0ad}
    body[data-admin-theme="thanksgiving"] .admin-module,body[data-admin-theme="thanksgiving"] .panel,body[data-admin-theme="thanksgiving"] .admin-card,body[data-admin-theme="thanksgiving"] .admin-stat-card{border-color:#9a6b3d55}
    body[data-admin-theme="thanksgiving"] .admin-module-head h2,body[data-admin-theme="thanksgiving"] .admin-module-head h3,body[data-admin-theme="thanksgiving"] .section-head h2,body[data-admin-theme="thanksgiving"] .section-head h3{color:#f4dfbd}
    body[data-admin-theme="thanksgiving"] .btn:not(.secondary),body[data-admin-theme="thanksgiving"] button.primary{background:linear-gradient(135deg,#a65f2c,#c58a3e);border-color:#d49a4a;color:#fff}
    body[data-admin-theme="thanksgiving"] .admin-kicker,body[data-admin-theme="thanksgiving"] .eyebrow{color:#e5b66f}
    body[data-admin-theme="thanksgiving"] .admin-status{border-color:#b8874e66}
    body[data-admin-theme="thanksgiving"] .admin-table th{background:#382719;color:#f3d9ad}
    body[data-admin-theme="thanksgiving"] .admin-table tr:hover{background:#d49a4a12}
    body[data-admin-theme="thanksgiving"] #crAdminThemeToggle{border-color:#d49a4a88;background:#24190f}
  `;
  document.head.appendChild(style);

  const mount = () => {
    if (document.getElementById("crAdminThemeControl")) return;
    const root = document.createElement("div");
    root.id = "crAdminThemeControl";
    root.innerHTML = `
      <button id="crAdminThemeToggle" type="button" aria-expanded="false" aria-controls="crAdminThemePanel">🎨 <span>Admin theme</span></button>
      <section id="crAdminThemePanel" hidden aria-label="Admin theme settings">
        <label for="crAdminThemeSelect">APPEARANCE</label>
        <select id="crAdminThemeSelect">
          <option value="original">Original theme</option>
          <option value="thanksgiving">🦃 Thanksgiving</option>
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
