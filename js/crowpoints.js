/* CrowRules Podcasting — sitewide CrowPoints shell
 * Loads on any page after config.js and Supabase JS v2.
 * Read-only by default: this script never awards points by guessing a database schema.
 */
(() => {
  'use strict';
  if (window.CrowPoints && window.CrowPoints.__loaded) return;
  const state = { client: null, user: null, lifetime: 0, monthly: 0, ready: false, error: null };
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
      #crowpoints-dock{position:fixed;right:14px;bottom:14px;z-index:9998;max-width:calc(100vw - 28px);padding:8px;border:1px solid rgba(103,232,249,.22);border-radius:16px;background:rgba(5,8,17,.92);backdrop-filter:blur(16px);box-shadow:0 12px 38px rgba(0,0,0,.35)}
      #crowpoints-dock .cp-sitewide{gap:6px}#crowpoints-dock .cp-pill{padding:7px 9px;font-size:11px}
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
      if (state.user) {
        const { data: summary, error: summaryError } = await client.rpc('get_my_crowpoints_summary');
        if (summaryError) throw summaryError;
        const row = Array.isArray(summary) ? summary[0] : summary;
        state.lifetime = number(row?.lifetime_points);
        state.monthly = number(row?.monthly_points);
        state.error = null;
      } else {
        state.lifetime = 0;
        state.monthly = 0;
        state.error = null;
      }
      state.ready = true;
      document.dispatchEvent(new CustomEvent('crowpoints:ready', { detail: { user: state.user, lifetime: state.lifetime, monthly: state.monthly } }));
    } catch (error) { state.ready = true; state.error = error?.message || 'CrowPoints could not be loaded'; }
    render();
    return state;
  }
  function markup() {
    if (!state.user) return '<span class="cp-sitewide"><span class="cp-pill"><span class="cp-icon">🪙</span><span>CrowPoints</span><span class="cp-muted">Sign in to view</span></span><a class="cp-login" href="' + loginUrl() + '">Sign in</a></span>';
    if (state.error) return '<span class="cp-sitewide"><span class="cp-pill"><span class="cp-icon">🪙</span><span>CrowPoints</span><span class="cp-muted">Temporarily unavailable</span></span><button type="button" class="cp-login" data-cp-retry style="background:none;border:0;cursor:pointer">Retry</button></span>';
    return '<span class="cp-sitewide"><span class="cp-pill" title="Lifetime CrowPoints"><span class="cp-icon">🪙</span><span>' + fmt(state.lifetime) + '</span><span class="cp-muted">Lifetime</span></span><span class="cp-pill" title="Monthly CrowPoints"><span class="cp-icon">⚡</span><span>' + fmt(state.monthly) + '</span><span class="cp-muted">Monthly</span></span></span>';
  }
  function challengesUrl() {
    const path = location.pathname;
    // The challenge center lives under /listener/; only listener pages are
    // already in that directory. Creator/admin pages need to cross into it.
    if (path.includes('/listener/')) return 'challenges.html';
    if (path.includes('/creator/') || path.includes('/admin/')) return '../listener/challenges.html';
    return 'listener/challenges.html';
  }
  function loginUrl() {
    const path = location.pathname;
    return (path.includes('/listener/') || path.includes('/creator/') || path.includes('/admin/')) ? '../login.html' : 'login.html';
  }
  function render() {
    styles();
    // Universal floating balance dock: appears on every page that loads this shared script.
    let dock = document.getElementById('crowpoints-dock');
    if (!dock) {
      dock = document.createElement('aside');
      dock.id = 'crowpoints-dock';
      dock.setAttribute('aria-label', 'Your CrowPoints balance');
      document.body.appendChild(dock);
    }
    dock.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<a href="' + escapeHtml(challengesUrl()) + '" style="font:800 9px Orbitron,Montserrat,sans-serif;letter-spacing:.06em;color:#a5f3fc;text-decoration:none;padding:7px 8px">CROWPOINTS</a>' +
      '<div data-crowpoints></div>' +
      '<button type="button" data-cp-dismiss aria-label="Hide CrowPoints balance" title="Hide balance" style="border:0;background:transparent;color:#9aa9bd;cursor:pointer;padding:5px">×</button></div>';
    dock.querySelector('[data-cp-dismiss]')?.addEventListener('click', () => { dock.hidden = true; });
    dock.querySelectorAll('[data-crowpoints]').forEach(el => { el.innerHTML = markup(); });
    dock.querySelectorAll('[data-cp-retry]').forEach(el => { if (!el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('click', refresh); } });
    document.querySelectorAll('[data-crowpoints]').forEach(el => { el.innerHTML = markup(); });
    document.querySelectorAll('[data-cp-retry]').forEach(el => { if (!el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('click', refresh); } });
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
    // Refresh earned balances while a signed-in member listens in another tab or player.
    window.setInterval(() => { if (state.user && !document.hidden) refresh(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user) refresh(); });
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
