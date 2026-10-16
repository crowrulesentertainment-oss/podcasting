/* CrowRules Podcasting — sitewide CrowPoints integration
 * Loads on any page after config.js and Supabase JS v2.
 * Read-only by default: this script never awards points by guessing a database schema.
 */
(() => {
  'use strict';
  if (window.CrowPoints && window.CrowPoints.__loaded) return;
  const state = { client: null, user: null, lifetime: 0, monthly: 0, ready: false, error: null, transactions: [], achievements: [], detailsLoaded: false, detailsLoading: false, detailsError: null, transactionOffset: 0, loadingMore: false, hasMoreTransactions: false };
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
      #crowpoints-dock{position:fixed;left:14px;right:auto;bottom:14px;z-index:9997;max-width:min(520px,calc(100vw - 28px));padding:8px;border:1px solid rgba(103,232,249,.22);border-radius:16px;background:rgba(5,8,17,.94);backdrop-filter:blur(16px);box-shadow:0 12px 38px rgba(0,0,0,.35)}
      #crowpoints-dock .cp-sitewide{gap:6px}#crowpoints-dock .cp-pill{padding:7px 9px;font-size:11px}
      #crowpoints-nav-balance,#crowpoints-hero-balance{display:inline-flex;align-items:center;max-width:100%;margin:4px 6px;vertical-align:middle}
      #crowpoints-nav-balance .cp-sitewide,#crowpoints-hero-balance .cp-sitewide{gap:5px}
      #crowpoints-nav-balance .cp-pill,#crowpoints-hero-balance .cp-pill{padding:7px 9px;font-size:11px}
      #crowpoints-nav-balance .cp-muted,#crowpoints-hero-balance .cp-muted{font-size:10px}
      #crowpoints-nav-balance .cp-login,#crowpoints-hero-balance .cp-login{display:inline-flex;align-items:center;padding:7px 9px;border:1px solid rgba(103,232,249,.3);border-radius:999px}
      #crowpoints-hero-balance{margin:0 8px 0 0}
      #crowpoints-hero-balance .cp-menu-toggle{white-space:nowrap}
      .cp-menu-toggle{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(103,232,249,.38);border-radius:999px;background:linear-gradient(120deg,rgba(103,232,249,.13),rgba(167,139,250,.15));color:#eafcff;font:800 11px Montserrat,system-ui,sans-serif;cursor:pointer}
      .cp-menu-toggle:hover,.cp-menu-toggle[aria-expanded="true"]{border-color:#67e8f9;box-shadow:0 0 20px rgba(103,232,249,.12)}
      #crowpoints-menu{position:fixed;top:76px;right:14px;z-index:10020;width:min(390px,calc(100vw - 24px));max-height:min(78vh,720px);overflow:auto;padding:18px;border:1px solid rgba(103,232,249,.32);border-radius:20px;background:linear-gradient(145deg,rgba(8,15,31,.98),rgba(22,14,43,.98));color:#eef7ff;box-shadow:0 22px 70px rgba(0,0,0,.55);backdrop-filter:blur(18px)}
      #crowpoints-menu[hidden]{display:none}
      .cp-menu-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
      .cp-menu-kicker{font:800 10px Orbitron,Montserrat,sans-serif;letter-spacing:.12em;color:#67e8f9}
      .cp-menu-close{border:1px solid #ffffff20;border-radius:9px;background:#ffffff08;color:#eafcff;padding:5px 9px;cursor:pointer}
      .cp-menu-balance{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .cp-menu-stat{padding:12px;border:1px solid #ffffff15;border-radius:13px;background:#ffffff07}
      .cp-menu-stat strong{display:block;font:800 20px Orbitron,Montserrat,sans-serif;color:#67e8f9;margin:5px 0}
      .cp-menu-stat span,.cp-menu-muted{font-size:11px;color:#9aa9bf}
      .cp-progress{height:7px;background:#ffffff12;border-radius:99px;overflow:hidden;margin:10px 0 6px}
      .cp-progress span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#53e7ff,#a78bfa);width:0;transition:width .25s}
      .cp-menu-section{margin-top:16px}
      .cp-menu-section h3{font:800 10px Orbitron,Montserrat,sans-serif;letter-spacing:.09em;color:#c9d6ee;margin:0 0 9px}
      .cp-menu-list{display:grid;gap:7px}
      .cp-menu-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 10px;border-radius:11px;background:#ffffff06;border:1px solid #ffffff0e}
      .cp-menu-row b{display:block;font-size:12px;overflow-wrap:anywhere}.cp-menu-row small{display:block;color:#9aa9bf;font-size:10px;margin-top:4px}
      .cp-menu-points{font-weight:800;color:#67e8f9;white-space:nowrap}
      .cp-menu-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
      .cp-menu-links a{flex:1;text-align:center;padding:10px 8px;border-radius:10px;border:1px solid rgba(103,232,249,.25);background:#67e8f90c;color:#bff7ff;font-size:11px;font-weight:800}
      .cp-menu-status{padding:12px;border:1px solid #ffffff12;border-radius:11px;color:#9aa9bf;font-size:12px}
      #crowpoints-nav-balance .cp-menu-toggle{margin:0}
      [data-crowpoints-card] .cp-menu-links{margin-top:12px}
      @media(max-width:620px){#crowpoints-nav-balance .cp-muted{display:none}#crowpoints-nav-balance .cp-pill{padding:7px}#crowpoints-nav-balance .cp-sitewide{gap:4px}#crowpoints-dock{left:8px;bottom:8px;max-width:calc(100vw - 16px)}#crowpoints-menu{top:64px;right:8px;width:calc(100vw - 16px);padding:14px}}
      @media(prefers-reduced-motion:reduce){#crowpoints-nav-balance *{transition:none!important}}
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
    if (!client) { state.ready = true; state.error = 'Supabase configuration is not ready'; render(); return state; }
    try {
      const { data: auth } = await client.auth.getSession();
      const previousUserId = state.user?.id || null;
      state.user = auth && auth.session && auth.session.user ? auth.session.user : null;
      if (previousUserId !== (state.user?.id || null)) {
        state.transactions = [];
        state.achievements = [];
        state.detailsLoaded = false;
        state.detailsLoading = false;
        state.detailsError = null;
        state.transactionOffset = 0;
        state.loadingMore = false;
        state.hasMoreTransactions = false;
        if (!state.user) {
          const rewardsPanel = document.getElementById('crowpoints-menu');
          if (rewardsPanel) rewardsPanel.hidden = true;
        }
      }
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
    return '<span class="cp-sitewide"><button type="button" class="cp-menu-toggle" data-cp-menu-toggle aria-controls="crowpoints-menu" aria-expanded="false"><span class="cp-icon">🪙</span><span>' + fmt(state.lifetime) + '</span><span class="cp-muted">CrowPoints</span><span aria-hidden="true">▾</span></button></span>';
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
  function achievementsUrl() {
    const path = location.pathname;
    if (path.includes('/listener/')) return 'challenges.html#achievements';
    if (path.includes('/creator/') || path.includes('/admin/')) return '../listener/challenges.html#achievements';
    return 'listener/challenges.html#achievements';
  }
  function ensureMenu() {
    let panel = document.getElementById('crowpoints-menu');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'crowpoints-menu';
      panel.hidden = true;
      panel.setAttribute('aria-label', 'CrowPoints rewards menu');
      document.body.appendChild(panel);
    }
    return panel;
  }
  function menuShell() {
    const progress = Math.min(100, Math.round(number(state.monthly)));
    return '<div class="cp-menu-head"><div><div class="cp-menu-kicker">CROWRULES REWARDS</div><div style="font-weight:800;margin-top:5px">Your CrowPoints</div><div class="cp-menu-muted" style="margin-top:4px">Earn points through verified listening and eligible rewards.</div></div><button type="button" class="cp-menu-close" data-cp-menu-close aria-label="Close CrowPoints menu">×</button></div>' +
      '<div class="cp-menu-balance"><div class="cp-menu-stat"><span>LIFETIME BALANCE</span><strong>' + fmt(state.lifetime) + '</strong><span>All-time points</span></div><div class="cp-menu-stat"><span>THIS MONTH</span><strong>' + fmt(state.monthly) + '</strong><span>Points earned this month</span></div></div>' +
      '<div class="cp-menu-section"><h3>MONTHLY PROGRESS</h3><div class="cp-menu-muted">' + fmt(state.monthly) + ' / 100 points toward the next 100-point milestone</div><div class="cp-progress" role="progressbar" aria-label="Monthly CrowPoints progress toward 100 points" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><span style="width:' + progress + '%"></span></div></div>' +
      '<div class="cp-menu-section"><h3>RECENT POINT ACTIVITY</h3><div class="cp-menu-list" data-cp-transactions><div class="cp-menu-status">Open the menu to load your recent activity.</div></div></div>' +
      '<div class="cp-menu-section"><h3>RECENT ACHIEVEMENTS</h3><div class="cp-menu-list" data-cp-achievements><div class="cp-menu-status">Achievements load when the menu opens.</div></div></div>' +
      '<div class="cp-menu-links"><a href="' + escapeHtml(challengesUrl()) + '">Challenges ↗</a><a href="' + escapeHtml(achievementsUrl()) + '">Achievements ↗</a><a href="' + escapeHtml(loginUrl()) + '">Account ↗</a></div>';
  }
  function relativeDate(value) {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  async function loadMenuDetails(force = false) {
    if (!state.user || state.detailsLoading || (state.detailsLoaded && !force)) return;
    state.detailsLoading = true;
    state.detailsError = null;
    const client = getClient();
    try {
      const [ledgerResult, achievementResult] = await Promise.all([
        client.from('crowrules_crowpoints_ledger')
          .select('id,points,reason,source,metadata,created_at')
          .eq('user_id', state.user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        client.from('podcast_listener_achievement_unlocks')
          .select('achievement_key,unlocked_at,metric_value,podcast_listener_achievement_definitions(name,icon,description)')
          .eq('user_id', state.user.id)
          .order('unlocked_at', { ascending: false })
          .limit(4)
      ]);
      if (ledgerResult.error) throw ledgerResult.error;
      state.transactions = ledgerResult.data || [];
      state.transactionOffset = state.transactions.length;
      state.hasMoreTransactions = state.transactions.length === 8;
      state.achievements = achievementResult.error ? [] : (achievementResult.data || []);
      state.detailsLoaded = true;
    } catch (error) {
      state.detailsError = error?.message || 'Could not load rewards activity.';
    } finally {
      state.detailsLoading = false;
      renderMenuDetails();
    }
  }
  async function loadMoreTransactions() {
    if (!state.user || state.loadingMore || state.detailsError) return;
    state.loadingMore = true;
    renderMenuDetails();
    try {
      const { data, error } = await getClient().from('crowrules_crowpoints_ledger')
        .select('id,points,reason,source,metadata,created_at')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false })
        .range(state.transactionOffset, state.transactionOffset + 7);
      if (error) throw error;
      state.transactions = state.transactions.concat(data || []);
      state.transactionOffset = state.transactions.length;
      state.hasMoreTransactions = (data || []).length === 8;
    } catch (error) {
      state.detailsError = error?.message || 'Could not load older activity.';
    } finally {
      state.loadingMore = false;
      renderMenuDetails();
    }
  }
  function renderMenuDetails() {
    const panel = document.getElementById('crowpoints-menu');
    if (!panel || panel.hidden) return;
    const transactions = panel.querySelector('[data-cp-transactions]');
    const achievements = panel.querySelector('[data-cp-achievements]');
    if (transactions) {
      if (state.detailsLoading) transactions.innerHTML = '<div class="cp-menu-status">Loading your latest rewards…</div>';
      else if (state.detailsError) transactions.innerHTML = '<div class="cp-menu-status">Activity could not be loaded. <button type="button" data-cp-details-retry style="background:none;border:0;color:#67e8f9;cursor:pointer">Try again</button></div>';
      else if (!state.transactions.length) transactions.innerHTML = '<div class="cp-menu-status">No point transactions yet. Verified listening and eligible challenges will appear here.</div>';
      else transactions.innerHTML = state.transactions.map(row => '<div class="cp-menu-row"><div><b>' + escapeHtml(row.reason || row.source || 'CrowPoints reward') + '</b><small>' + escapeHtml(relativeDate(row.created_at)) + (row.source ? ' · ' + escapeHtml(row.source) : '') + '</small></div><span class="cp-menu-points">' + (Number(row.points) > 0 ? '+' : Number(row.points) < 0 ? '−' : '') + fmt(Math.abs(Number(row.points) || 0)) + '</span></div>').join('') + (state.hasMoreTransactions ? '<button type="button" data-cp-load-more style="width:100%;padding:9px;border:1px solid #ffffff1e;border-radius:10px;background:#ffffff08;color:#bff7ff;cursor:pointer;font-weight:700;font-size:11px">' + (state.loadingMore ? 'Loading older activity…' : 'Load older activity') + '</button>' : '');
    }
    if (achievements) {
      if (state.detailsLoading) achievements.innerHTML = '<div class="cp-menu-status">Loading achievements…</div>';
      else if (!state.achievements.length) achievements.innerHTML = '<div class="cp-menu-status">No unlocked achievements to show yet. Explore challenges to get started.</div>';
      else achievements.innerHTML = state.achievements.map(row => {
        const def = Array.isArray(row.podcast_listener_achievement_definitions) ? row.podcast_listener_achievement_definitions[0] : row.podcast_listener_achievement_definitions;
        return '<div class="cp-menu-row"><div><b>' + escapeHtml((def && def.icon ? def.icon + ' ' : '🏆 ') + ((def && def.name) || row.achievement_key || 'Achievement')) + '</b><small>' + escapeHtml((def && def.description) || ('Unlocked ' + relativeDate(row.unlocked_at))) + '</small></div><span class="cp-menu-points">✓</span></div>';
      }).join('');
    }
    const more = panel.querySelector('[data-cp-load-more]');
    if (more && !more.dataset.bound) {
      more.dataset.bound = '1';
      more.addEventListener('click', loadMoreTransactions);
    }
    const retry = panel.querySelector('[data-cp-details-retry]');
    if (retry && !retry.dataset.bound) {
      retry.dataset.bound = '1';
      retry.addEventListener('click', () => { state.detailsLoaded = false; loadMenuDetails(true); });
    }
  }
  function bindMenu() {
    const panel = ensureMenu();
    document.querySelectorAll('[data-cp-menu-toggle]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        const open = panel.hidden;
        panel.innerHTML = menuShell();
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) {
          renderMenuDetails();
          loadMenuDetails();
          panel.querySelector('[data-cp-menu-close]')?.addEventListener('click', () => {
            panel.hidden = true;
            document.querySelectorAll('[data-cp-menu-toggle]').forEach(item => item.setAttribute('aria-expanded', 'false'));
          });
        }
      });
    });
    panel.querySelectorAll('[data-cp-menu-close]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        panel.hidden = true;
        document.querySelectorAll('[data-cp-menu-toggle]').forEach(item => item.setAttribute('aria-expanded', 'false'));
      });
    });
  }
  function render() {
    styles();
    const hero = document.querySelector('.listener-hero .hero-actions, .hero .hero-actions, .hero .actions, .hero-actions, .hero-cta, .hero-actions-row, header .hero-actions');
    const nav = document.querySelector('header nav, nav[aria-label="Main navigation"], nav[aria-label="Primary navigation"], header .nav-links, header .nav, nav');
    let heroBalance = document.getElementById('crowpoints-hero-balance');
    let navBalance = document.getElementById('crowpoints-nav-balance');
    let dock = document.getElementById('crowpoints-dock');

    // Prefer the hero CTA row, keeping CrowPoints alongside the page's main actions.
    // Fall back to navigation on pages without a hero, then to a dock on minimal pages.
    if (hero) {
      if (!heroBalance) {
        heroBalance = document.createElement('span');
        heroBalance.id = 'crowpoints-hero-balance';
        heroBalance.setAttribute('aria-label', 'CrowPoints member balance');
      }
      if (!hero.contains(heroBalance)) hero.appendChild(heroBalance);
      navBalance?.remove();
      dock?.remove();
      heroBalance.innerHTML = markup();
    } else if (nav) {
      if (!navBalance) {
        navBalance = document.createElement('span');
        navBalance.id = 'crowpoints-nav-balance';
        navBalance.setAttribute('aria-label', 'CrowPoints member balance');
      }
      if (!nav.contains(navBalance)) nav.appendChild(navBalance);
      heroBalance?.remove();
      if (dock) dock.remove();
      navBalance.innerHTML = markup();
    } else if (document.querySelector('[data-crowpoints-card]')) {
      // Pages with a dedicated rewards card use that inline mount instead of a dock.
      heroBalance?.remove();
      navBalance?.remove();
      if (dock) dock.remove();
    } else {
      heroBalance?.remove();
      navBalance?.remove();
      if (!dock) {
        dock = document.createElement('aside');
        dock.id = 'crowpoints-dock';
        dock.setAttribute('aria-label', 'Your CrowPoints balance');
        document.body.appendChild(dock);
      }
      dock.hidden = false;
      dock.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<a href="' + escapeHtml(challengesUrl()) + '" style="font:800 9px Orbitron,Montserrat,sans-serif;letter-spacing:.06em;color:#a5f3fc;text-decoration:none;padding:7px 8px">CROWPOINTS</a>' +
        '<div data-crowpoints></div>' +
        '<button type="button" data-cp-dismiss aria-label="Hide CrowPoints balance" title="Hide balance" style="border:0;background:transparent;color:#9aa9bd;cursor:pointer;padding:5px">×</button></div>';
      dock.querySelector('[data-cp-dismiss]')?.addEventListener('click', () => { dock.hidden = true; });
      dock.querySelectorAll('[data-crowpoints]').forEach(el => { el.innerHTML = markup(); });
    }
    document.querySelectorAll('[data-crowpoints]').forEach(el => { el.innerHTML = markup(); });
    document.querySelectorAll('[data-cp-retry]').forEach(el => {
      if (!el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('click', refresh); }
    });
    document.querySelectorAll('[data-crowpoints-card]').forEach(el => {
      el.innerHTML = '<div class="cp-card"><div><strong>CROWRULES REWARDS</strong><div class="cp-muted" style="margin-top:5px">One account. One universe.</div><div class="cp-menu-links"><a href="' + escapeHtml(challengesUrl()) + '">Challenges ↗</a><a href="' + escapeHtml(achievementsUrl()) + '">Achievements ↗</a></div></div>' + markup() + '</div>';
    });
    const panel = document.getElementById('crowpoints-menu');
    if (panel && !panel.hidden) {
      panel.innerHTML = menuShell();
      renderMenuDetails();
    }
    bindMenu();
  }
  // Refresh the displayed balance immediately after the server confirms a
  // verified whole-minute listening reward.
  document.addEventListener('crowpoints:balance-refresh', () => { refresh(); });
  window.addEventListener('crowrules:config-ready', () => { refresh(); });
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
    window.setInterval(() => { if (!document.hidden) refresh(); }, 60000);
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
