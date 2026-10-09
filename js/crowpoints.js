/* CrowRules Podcasting — sitewide CrowPoints shell
 * Loads on any page after config.js and Supabase JS v2.
 * Read-only by default: this script never awards points by guessing a database schema.
 */
(() => {
  'use strict';
  if (window.CrowPoints && window.CrowPoints.__loaded) return;
  const state = { client: null, user: null, lifetime: 0, monthly: 0, ready: false };
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const fmt = value => Math.floor(number(value)).toLocaleString();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function styles() {
    if (document.getElementById('crowpoints-sitewide-style')) return;
    const style = document.createElement('style');
    style.id = 'crowpoints-sitewide-style';
    style.textContent = `
      .cp-sitewide{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font:700 12px/1.2 Montserrat,system-ui,sans-serif;color:#eafcff}
      .cp-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(103,232,249,.3);border-radius:999px;background:linear-gradient(120deg,rgba(103,232,249,.10),rgba(167,139,250,.10));box-shadow:0 0 22px rgba(103,232,249,.06)}
      .cp-icon{font-size:15px}.cp-muted{color:#9aa9bd;font-weight:600}.cp-login{color:#8defff;text-decoration:none}
      .cp-card{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid rgba(103,232,249,.22);border-radius:14px;background:rgba(8,14,27,.78)}
      .cp-card strong{font:800 11px Orbitron,Montserrat,sans-serif;letter-spacing:.08em}
      @media(prefers-reduced-motion:no-preference){.cp-pill{transition:border-color .2s,transform .2s}.cp-pill:hover{border-color:rgba(103,232,249,.7);transform:translateY(-1px)}}
    `;
    document.head.appendChild(style);
  }
  function getClient() {
    if (state.client) return state.client;
    const cfg = window.CROW_CONFIG || {};
    const sdk = window.supabase;
    if (!cfg.supabaseUrl || !cfg.supabaseKey || !sdk || typeof sdk.createClient !== 'function') return null;
    try { state.client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseKey); return state.client; } catch (_) { return null; }
  }
  async function refresh() {
    const client = getClient();
    if (!client) return state;
    try {
      const { data: auth } = await client.auth.getUser();
      state.user = auth && auth.user ? auth.user : null;
      state.ready = true;
      // Profile/points schema varies across CrowRules projects. The shell intentionally
      // does not query or write guessed table/column names.
      document.dispatchEvent(new CustomEvent('crowpoints:ready', { detail: { user: state.user, lifetime: state.lifetime, monthly: state.monthly } }));
    } catch (_) { state.ready = true; }
    render();
    return state;
  }
  function markup() {
    if (!state.user) return '<span class="cp-sitewide"><span class="cp-pill"><span class="cp-icon">🪙</span><span>CrowPoints</span><span class="cp-muted">Sign in to view</span></span><a class="cp-login" href="' + loginUrl() + '">Sign in</a></span>';
    return '<span class="cp-sitewide"><span class="cp-pill" title="Lifetime CrowPoints"><span class="cp-icon">🪙</span><span>' + fmt(state.lifetime) + '</span><span class="cp-muted">Lifetime</span></span><span class="cp-pill" title="Monthly CrowPoints"><span class="cp-icon">⚡</span><span>' + fmt(state.monthly) + '</span><span class="cp-muted">Monthly</span></span></span>';
  }
  function loginUrl() {
    const path = location.pathname;
    return (path.includes('/listener/') || path.includes('/creator/') || path.includes('/admin/')) ? '../login.html' : 'login.html';
  }
  function render() {
    styles();
    document.querySelectorAll('[data-crowpoints]').forEach(el => { el.innerHTML = markup(); });
    document.querySelectorAll('[data-crowpoints-card]').forEach(el => {
      el.innerHTML = '<div class="cp-card"><div><strong>CROWRULES REWARDS</strong><div class="cp-muted" style="margin-top:5px">One account. One universe.</div></div>' + markup() + '</div>';
    });
  }
  function mount() {
    styles();
    // Optional universal mount point can be added to any page/header: data-crowpoints.
    render();
    refresh();
    const client = getClient();
    if (client && client.auth && client.auth.onAuthStateChange) {
      client.auth.onAuthStateChange(() => { refresh(); });
    }
  }
  window.CrowPoints = {
    __loaded: true,
    refresh,
    render,
    getState: () => ({ ...state }),
    // Shared event contract for players/episodes to notify the rewards layer.
    // Actual point awards must be performed by a trusted, schema-aware server function.
    track: (eventName, detail = {}) => document.dispatchEvent(new CustomEvent('crowpoints:activity', {
      detail: { eventName: String(eventName || ''), ...detail, userId: state.user?.id || null, at: new Date().toISOString() }
    }))
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
