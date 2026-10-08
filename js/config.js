// CrowRules Podcasting public browser configuration.
// Publishable key only — never place a Supabase service-role/secret key here.
// Sitewide singleton: every Podcasting page shares the same Supabase client/session.
window.CROW_PODCASTING_CONFIG = {
  supabaseUrl: "https://cevylpnoexugwgygvtgu.supabase.co",
  supabasePublishableKey: "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
  stripeCheckoutFunction: "podcast-subscription-checkout"
};

(() => {
  "use strict";
  const C = window.CROW_PODCASTING_CONFIG;
  if (!C?.supabaseUrl || !C?.supabasePublishableKey) {
    console.error("CrowRules Podcasting: Supabase configuration is missing.");
    return;
  }
  if (!window.supabase?.createClient) {
    console.error("CrowRules Podcasting: Supabase JS client did not load before config.js.");
    window.CROW_SUPABASE_READY = Promise.reject(new Error("Supabase JS client unavailable"));
    return;
  }
  if (!window.CROW_PODCASTING) {
    try {
      window.CROW_PODCASTING = window.supabase.createClient(
        C.supabaseUrl,
        C.supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce"
          }
        }
      );
    } catch (error) {
      console.error("CrowRules Podcasting: failed to initialize Supabase.", error);
      window.CROW_SUPABASE_READY = Promise.reject(error);
      return;
    }
  }

  const sb = window.CROW_PODCASTING;
  window.CROW_SUPABASE_READY = Promise.resolve(sb);

  // Sitewide holiday theme: one setting controls every Podcasting page.
  const applyHolidayTheme = (row) => {
    const enabled = !!row?.holiday_enabled;
    const theme = String(row?.holiday_theme || "standard").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const allowed = new Set(["standard","halloween","christmas","thanksgiving","newyear","valentines","spring","easter","independence"]);
    const safeTheme = allowed.has(theme) ? theme : "standard";
    document.documentElement.classList.remove(...Array.from(allowed).filter(x => x !== "standard").map(x => "theme-" + x));
    if (enabled && safeTheme !== "standard") document.documentElement.classList.add("theme-" + safeTheme);
    document.documentElement.dataset.crowHolidayTheme = enabled ? safeTheme : "standard";
    document.documentElement.dataset.crowHolidayEnabled = enabled ? "true" : "false";
    window.CROW_HOLIDAY_THEME = { enabled, theme: enabled ? safeTheme : "standard" };
    if (enabled && safeTheme === "halloween") { halloweenFX(); removeChristmasFX(); removeThanksgivingFX(); } else if (enabled && safeTheme === "christmas") { removeHalloweenFX(); removeThanksgivingFX(); christmasFX(); christmasCountdownFX(); } else if (enabled && safeTheme === "thanksgiving") { removeHalloweenFX(); removeChristmasFX(); removeNewyearFX(); document.getElementById("crow-christmas-countdown")?.remove(); thanksgivingFX(); } else if (enabled && safeTheme === "newyear") { removeHalloweenFX(); removeChristmasFX(); removeThanksgivingFX(); removeValentinesFX(); document.getElementById("crow-christmas-countdown")?.remove(); newyearFX(); } else if (enabled && safeTheme === "valentines") { removeHalloweenFX(); removeChristmasFX(); removeThanksgivingFX(); removeNewyearFX(); removeSpringFX(); document.getElementById("crow-christmas-countdown")?.remove(); valentinesFX(); } else if (enabled && safeTheme === "spring") { removeHalloweenFX(); removeChristmasFX(); removeThanksgivingFX(); removeNewyearFX(); removeValentinesFX(); document.getElementById("crow-christmas-countdown")?.remove(); springFX(); } else if (enabled && safeTheme === "easter") { removeHalloweenFX(); removeChristmasFX(); removeThanksgivingFX(); removeNewyearFX(); removeValentinesFX(); removeSpringFX(); removeEasterFX(); removeIndependenceFX(); document.getElementById("crow-christmas-countdown")?.remove(); easterFX(); } else { removeHalloweenFX(); removeChristmasFX(); removeThanksgivingFX(); removeNewyearFX(); removeValentinesFX(); removeSpringFX(); document.getElementById("crow-christmas-countdown")?.remove(); document.getElementById("crow-santa-delivery")?.remove(); }
    window.dispatchEvent(new CustomEvent("crowrules:holiday-theme", { detail: window.CROW_HOLIDAY_THEME }));
  };
  window.CROW_APPLY_HOLIDAY_THEME = applyHolidayTheme;
  // Halloween atmosphere controller: adds lightweight cinematic particle layers.
  const halloweenFX = () => {
    if (document.getElementById("crow-halloween-fx")) return;
    const root = document.createElement("div"); root.id="crow-halloween-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-halloween-moon"></div><div class="crow-halloween-fog fog-a"></div><div class="crow-halloween-fog fog-b"></div><div class="crow-halloween-ghosts"><span class="ghost g1">👻</span><span class="ghost g2">👻</span><span class="ghost g3">👻</span></div><div class="crow-halloween-witches"><span class="witch w1">🧙‍♀️</span><span class="witch w2">🧙‍♀️</span></div><div class="crow-halloween-bats"><span>🦇</span><span>🦇</span><span>🦇</span><span>🦇</span></div><div class="crow-halloween-pumpkins"><span>🎃</span><span>🎃</span><span>🎃</span></div><div class="crow-halloween-embers"></div>';
    document.body.appendChild(root);
    const emb=root.querySelector(".crow-halloween-embers");
    for(let i=0;i<18;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--d",(5+Math.random()*10)+"s");p.style.setProperty("--delay",(-Math.random()*12)+"s");p.style.setProperty("--drift",(-35+Math.random()*70)+"px");emb.appendChild(p);}
  };
  const removeHalloweenFX = () => document.getElementById("crow-halloween-fx")?.remove();


  // Christmas atmosphere controller: falling snow, Santa flight, lights, stars and glow.
  const christmasFX = () => {
    if (document.getElementById("crow-christmas-fx")) return;
    const root = document.createElement("div"); root.id="crow-christmas-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-christmas-sky"></div><div class="crow-christmas-moon"></div><div class="crow-christmas-lights"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="crow-christmas-snow"></div><div class="crow-christmas-sparkles"></div><div class="crow-christmas-trees"><span>🎄</span><span>🎄</span><span>🎄</span></div>';
    document.body.appendChild(root);
    const snow=root.querySelector(".crow-christmas-snow");
    for(let i=0;i<55;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(2+Math.random()*5)+"px");p.style.setProperty("--d",(7+Math.random()*12)+"s");p.style.setProperty("--delay",(-Math.random()*18)+"s");p.style.setProperty("--drift",(-45+Math.random()*90)+"px");p.style.setProperty("--spin",(180+Math.random()*360)+"deg");snow.appendChild(p);}
    const spark=root.querySelector(".crow-christmas-sparkles");
    for(let i=0;i<22;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",Math.random()*90+"vh");p.style.setProperty("--delay",(-Math.random()*5)+"s");spark.appendChild(p);}
  };
  const removeChristmasFX = () => document.getElementById("crow-christmas-fx")?.remove();

  // Thanksgiving atmosphere: autumn leaves, warm lanterns and harvest ambience.
  const thanksgivingFX = () => {
    if (document.getElementById("crow-thanksgiving-fx")) return;
    const root=document.createElement("div"); root.id="crow-thanksgiving-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-thanksgiving-sky"></div><div class="crow-thanksgiving-moon"></div><div class="crow-thanksgiving-lanterns"><span>🏮</span><span>🏮</span><span>🏮</span></div><div class="crow-thanksgiving-leaves"></div><div class="crow-thanksgiving-pumpkins"><span>🎃</span><span>🎃</span><span>🎃</span></div><div class="crow-thanksgiving-harvest"><span>🌾</span><span>🌾</span><span>🌾</span></div><div class="crow-thanksgiving-sparkles"></div>';
    document.body.appendChild(root);
    const leaves=root.querySelector(".crow-thanksgiving-leaves");
    const symbols=["🍂","🍁","🍃","🍂","🍁"];
    for(let i=0;i<38;i++){const p=document.createElement("i");p.textContent=symbols[i%symbols.length];p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(10+Math.random()*13)+"px");p.style.setProperty("--d",(8+Math.random()*13)+"s");p.style.setProperty("--delay",(-Math.random()*20)+"s");p.style.setProperty("--drift",(-80+Math.random()*160)+"px");p.style.setProperty("--spin",(360+Math.random()*540)+"deg");leaves.appendChild(p);}
    const spark=root.querySelector(".crow-thanksgiving-sparkles");
    for(let i=0;i<18;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",Math.random()*85+"vh");p.style.setProperty("--delay",(-Math.random()*5)+"s");spark.appendChild(p);}
  };
  const removeThanksgivingFX = () => document.getElementById("crow-thanksgiving-fx")?.remove();

  // Spring atmosphere: drifting blossoms, butterflies, fireflies and fresh dawn ambience.
  const springFX = () => {
    if(document.getElementById("crow-spring-fx")) return;
    const root=document.createElement("div"); root.id="crow-spring-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-spring-sky"></div><div class="crow-spring-sun"></div><div class="crow-spring-clouds"><span></span><span></span><span></span></div><div class="crow-spring-blossoms"></div><div class="crow-spring-butterflies"><span>🦋</span><span>🦋</span><span>🦋</span><span>🦋</span></div><div class="crow-spring-fireflies"></div><div class="crow-spring-grass"><span>🌱</span><span>🌱</span><span>🌱</span></div><div class="crow-spring-message">NEW SEASON • NEW POSSIBILITIES</div>';
    document.body.appendChild(root);
    const blossoms=root.querySelector(".crow-spring-blossoms"), fire=root.querySelector(".crow-spring-fireflies");
    for(let i=0;i<34;i++){const p=document.createElement("i");p.textContent=i%2?"✿":"❀";p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(9+Math.random()*14)+"px");p.style.setProperty("--d",(9+Math.random()*14)+"s");p.style.setProperty("--delay",(-Math.random()*20)+"s");p.style.setProperty("--drift",(-75+Math.random()*150)+"px");p.style.setProperty("--spin",(180+Math.random()*540)+"deg");blossoms.appendChild(p);}
    for(let i=0;i<24;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",(35+Math.random()*55)+"vh");p.style.setProperty("--delay",(-Math.random()*6)+"s");fire.appendChild(p);}
  };
  const removeSpringFX = () => document.getElementById("crow-spring-fx")?.remove();

  // Easter atmosphere: moonlit meadow, glowing eggs, blossoms, rabbits and sunrise sparkle.
  const easterFX = () => {
    if(document.getElementById("crow-easter-fx")) return;
    const root=document.createElement("div"); root.id="crow-easter-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-easter-sky"></div><div class="crow-easter-moon"></div><div class="crow-easter-clouds"><span></span><span></span></div><div class="crow-easter-eggs"></div><div class="crow-easter-petals"></div><div class="crow-easter-rabbits"><span>🐇</span><span>🐇</span></div><div class="crow-easter-sparkles"></div><div class="crow-easter-grass">🌿　🌷　🌿　🌷　🌿</div><div class="crow-easter-message">EASTER • RENEWAL • NEW BEGINNINGS</div>';
    document.body.appendChild(root);
    const eggs=root.querySelector(".crow-easter-eggs"), petals=root.querySelector(".crow-easter-petals"), sparkles=root.querySelector(".crow-easter-sparkles");
    for(let i=0;i<18;i++){const p=document.createElement("i");p.textContent="🥚";p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(13+Math.random()*15)+"px");p.style.setProperty("--d",(8+Math.random()*12)+"s");p.style.setProperty("--delay",(-Math.random()*18)+"s");p.style.setProperty("--drift",(-55+Math.random()*110)+"px");eggs.appendChild(p);}
    for(let i=0;i<28;i++){const p=document.createElement("i");p.textContent=i%2?"✿":"❀";p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(8+Math.random()*12)+"px");p.style.setProperty("--d",(10+Math.random()*13)+"s");p.style.setProperty("--delay",(-Math.random()*20)+"s");petals.appendChild(p);}
    for(let i=0;i<22;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",(20+Math.random()*65)+"vh");p.style.setProperty("--delay",(-Math.random()*5)+"s");sparkles.appendChild(p);}
  };
  const removeEasterFX = () => document.getElementById("crow-easter-fx")?.remove();

  // Independence Day: patriotic night sky, stars, fireworks and celebration glow.
  const independenceFX = () => {
    if(document.getElementById("crow-independence-fx")) return;
    const root=document.createElement("div"); root.id="crow-independence-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-independence-sky"></div><div class="crow-independence-moon"></div><div class="crow-independence-stars"></div><div class="crow-independence-fireworks"></div><div class="crow-independence-confetti"></div><div class="crow-independence-message">INDEPENDENCE • FREEDOM • CELEBRATION</div><div class="crow-independence-year">1776</div>';
    document.body.appendChild(root);
    const stars=root.querySelector(".crow-independence-stars"), fireworks=root.querySelector(".crow-independence-fireworks"), confetti=root.querySelector(".crow-independence-confetti");
    for(let i=0;i<65;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",Math.random()*70+"vh");p.style.setProperty("--d",(2+Math.random()*4)+"s");p.style.setProperty("--delay",(-Math.random()*5)+"s");stars.appendChild(p);}
    for(let i=0;i<11;i++){const p=document.createElement("i");p.style.setProperty("--x",(10+Math.random()*80)+"vw");p.style.setProperty("--y",(12+Math.random()*48)+"vh");p.style.setProperty("--d",(2.5+Math.random()*2)+"s");p.style.setProperty("--delay",(-Math.random()*7)+"s");p.style.setProperty("--size",(35+Math.random()*70)+"px");fireworks.appendChild(p);}
    for(let i=0;i<32;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--d",(5+Math.random()*7)+"s");p.style.setProperty("--delay",(-Math.random()*12)+"s");p.style.setProperty("--drift",(-80+Math.random()*160)+"px");confetti.appendChild(p);}
  };
  const removeIndependenceFX = () => document.getElementById("crow-independence-fx")?.remove();

  // Valentine's atmosphere: glowing hearts, rose petals, stars and romantic neon ambience.
  const valentinesFX = () => {
    if(document.getElementById("crow-valentines-fx")) return;
    const root=document.createElement("div"); root.id="crow-valentines-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-valentines-sky"></div><div class="crow-valentines-moon"></div><div class="crow-valentines-glow"></div><div class="crow-valentines-hearts"></div><div class="crow-valentines-petals"></div><div class="crow-valentines-sparkles"></div><div class="crow-valentines-message">LOVE • CONNECTION • CROW RULES</div>';
    document.body.appendChild(root);
    const hearts=root.querySelector(".crow-valentines-hearts"), petals=root.querySelector(".crow-valentines-petals"), spark=root.querySelector(".crow-valentines-sparkles");
    for(let i=0;i<24;i++){const p=document.createElement("i");p.textContent=i%3===0?"♥":"♡";p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(12+Math.random()*20)+"px");p.style.setProperty("--d",(8+Math.random()*12)+"s");p.style.setProperty("--delay",(-Math.random()*18)+"s");p.style.setProperty("--drift",(-55+Math.random()*110)+"px");hearts.appendChild(p);}
    for(let i=0;i<30;i++){const p=document.createElement("i");p.textContent="✿";p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--s",(8+Math.random()*12)+"px");p.style.setProperty("--d",(9+Math.random()*13)+"s");p.style.setProperty("--delay",(-Math.random()*20)+"s");p.style.setProperty("--drift",(-70+Math.random()*140)+"px");petals.appendChild(p);}
    for(let i=0;i<20;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",Math.random()*88+"vh");p.style.setProperty("--delay",(-Math.random()*5)+"s");spark.appendChild(p);}
  };
  const removeValentinesFX = () => document.getElementById("crow-valentines-fx")?.remove();

  // New Year's Eve atmosphere: countdown, fireworks, confetti and midnight celebration.
  const newyearFX = () => {
    if(document.getElementById("crow-newyear-fx")) return;
    const root=document.createElement("div"); root.id="crow-newyear-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-newyear-sky"></div><div class="crow-newyear-moon"></div><div class="crow-newyear-stars"></div><div class="crow-newyear-fireworks"></div><div class="crow-newyear-confetti"></div><div class="crow-newyear-year">2027</div><div class="crow-newyear-message">✨ NEW YEAR • NEW CHAPTER ✨</div>';
    document.body.appendChild(root);
    const stars=root.querySelector(".crow-newyear-stars"); for(let i=0;i<55;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--y",Math.random()*72+"vh");p.style.setProperty("--delay",(-Math.random()*6)+"s");stars.appendChild(p);}
    const fireworks=root.querySelector(".crow-newyear-fireworks"); for(let i=0;i<9;i++){const p=document.createElement("i");p.style.setProperty("--x",(8+Math.random()*84)+"vw");p.style.setProperty("--y",(12+Math.random()*50)+"vh");p.style.setProperty("--delay",(Math.random()*6)+"s");p.style.setProperty("--h",(2+Math.random()*4)+"s");fireworks.appendChild(p);}
    const confetti=root.querySelector(".crow-newyear-confetti"); for(let i=0;i<30;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--d",(6+Math.random()*8)+"s");p.style.setProperty("--delay",(-Math.random()*10)+"s");p.style.setProperty("--drift",(-80+Math.random()*160)+"px");p.style.setProperty("--r",(360+Math.random()*720)+"deg");confetti.appendChild(p);}
  };
  const removeNewyearFX = () => document.getElementById("crow-newyear-fx")?.remove();

  // Christmas Eve countdown + Santa gift-delivery sequence.
  const christmasCountdownFX = () => {
    if (!document.getElementById("crow-christmas-countdown")) {
      const box=document.createElement("div"); box.id="crow-christmas-countdown"; box.setAttribute("aria-live","polite"); box.innerHTML='<div class="christmas-countdown-label">🎄 CHRISTMAS EVE COUNTDOWN</div><div class="christmas-countdown-time"><span data-cd-days>00</span><b>D</b><span data-cd-hours>00</span><b>H</b><span data-cd-minutes>00</span><b>M</b><span data-cd-seconds>00</span><b>S</b></div><div class="christmas-countdown-message">Santa is getting ready...</div>';
      document.body.appendChild(box);
    }
    const box=document.getElementById("crow-christmas-countdown");
    const update=()=>{
      const now=new Date(), target=new Date(now.getFullYear(),11,24,0,0,0,0);
      if(now>target) target.setFullYear(target.getFullYear()+1);
      const diff=Math.max(0,target-now), day=Math.floor(diff/86400000), hr=Math.floor(diff%86400000/3600000), min=Math.floor(diff%3600000/60000), sec=Math.floor(diff%60000/1000);
      box.querySelector("[data-cd-days]").textContent=String(day).padStart(2,"0"); box.querySelector("[data-cd-hours]").textContent=String(hr).padStart(2,"0"); box.querySelector("[data-cd-minutes]").textContent=String(min).padStart(2,"0"); box.querySelector("[data-cd-seconds]").textContent=String(sec).padStart(2,"0");
      box.querySelector(".christmas-countdown-message").textContent=diff<=0?"🎄 MERRY CHRISTMAS EVE — THE HOLIDAY CELEBRATION HAS BEGUN!":"Christmas is getting closer...";
    }; update(); if(!box._timer) box._timer=setInterval(update,1000);
  };
  const santaGiftDeliveryFX = () => {
    if(document.getElementById("crow-santa-delivery")) return;
    const root=document.createElement("div"); root.id="crow-santa-delivery"; root.setAttribute("aria-hidden","true"); root.innerHTML='<div class="santa-delivery-title">🎅 SANTA DELIVERY IN PROGRESS</div><div class="santa-route"><span class="santa-gift-bag">🎁</span><span class="santa-sleigh">🛷🎅</span></div><div class="santa-gifts">🎁　🎁　🎁　🎁</div>'; document.body.appendChild(root);
  };
  const removeSantaGiftDeliveryFX = () => document.getElementById("crow-santa-delivery")?.remove();

  if (document.documentElement.dataset.crowHolidayTheme === "christmas") christmasCountdownFX();

  const loadHolidayTheme = async () => {
    try {
      const { data, error } = await sb.from("crp_site_settings").select("holiday_theme,holiday_enabled,updated_at").eq("site_key", "podcasting").maybeSingle();
      if (!error) applyHolidayTheme(data || null);
    } catch (error) { console.warn("CrowRules Podcasting: holiday theme bootstrap failed.", error); }
  };
  loadHolidayTheme();
  try {
    sb.channel("crowrules-sitewide-theme")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crp_site_settings", filter: "site_key=eq.podcasting" }, payload => applyHolidayTheme(payload.new))
      .subscribe();
  } catch (error) { console.warn("CrowRules Podcasting: holiday theme realtime unavailable.", error); }

  if (!window.CROW_AUTH_STATE) {
    window.CROW_AUTH_STATE = { session: null, user: null, event: "INITIALIZED" };
  }

  const publish = (event, session) => {
    const user = session?.user || null;
    window.CROW_AUTH_STATE = { session: session || null, user, event };
    window.dispatchEvent(new CustomEvent("crowrules:auth", {
      detail: { event, session: session || null, user }
    }));
    if (window.CrowAccount?.refresh) window.CrowAccount.refresh();
  };

  sb.auth.getSession()
    .then(({ data }) => publish("INITIAL_SESSION", data?.session || null))
    .catch(error => console.warn("CrowRules Podcasting: session bootstrap failed.", error));

  if (!window.CrowAccount) {
    const listeners = new Set();
    let account = { session: null, user: null, profile: null, member: null, creator: null, membership: null, loading: true, lastError: null };
    const notify = () => {
      const snapshot = Object.freeze({ ...account });
      listeners.forEach(fn => { try { fn(snapshot); } catch (e) { console.warn("CrowAccount listener:", e); } });
      window.dispatchEvent(new CustomEvent("crowrules:account", { detail: snapshot }));
    };
    const loadAccount = async (sessionOverride) => {
      const session = sessionOverride === undefined ? account.session : sessionOverride;
      const user = session?.user || null;
      account = { ...account, session: session || null, user, loading: true, lastError: null };
      notify();
      if (!user) {
        account = { ...account, profile: null, member: null, creator: null, membership: null, loading: false };
        notify(); return account;
      }
      try {
        const [pr, mr] = await Promise.all([
          sb.from("podcasting_profiles").select("*").eq("id", user.id).maybeSingle(),
          sb.from("members").select("id,user_id,first_name,last_name,username,email,membership_type,role,status,points,watch_minutes,bio,avatar_url,last_active_at,display_name").eq("user_id", user.id).maybeSingle()
        ]);
        if (pr.error) throw pr.error;
        if (mr.error) throw mr.error;
        const member = mr.data || null;
        let creator = null;
        if (member?.id) {
          const cr = await sb.from("creators").select("id,name,display_name,avatar_url,is_active,role,discipline,member_id").eq("member_id", member.id).maybeSingle();
          if (!cr.error) creator = cr.data || null;
        }
        account = { ...account, profile: pr.data || null, member, creator,
          membership: { type: member?.membership_type || "free", status: member?.status || null, role: member?.role || null, points: Number(member?.points || 0) },
          loading: false };
      } catch (error) { account = { ...account, loading: false, lastError: error }; }
      notify(); return account;
    };
    window.CrowAccount = Object.freeze({
      get: () => ({ ...account }),
      user: () => account.user,
      session: () => account.session,
      profile: () => account.profile,
      membership: () => account.membership,
      creator: () => account.creator,
      isSignedIn: () => !!account.user,
      isCreator: () => !!account.creator?.is_active || !!account.profile?.is_creator,
      refresh: () => loadAccount(),
      onChange: (fn) => { if (typeof fn !== "function") return () => {}; listeners.add(fn); fn({ ...account }); return () => listeners.delete(fn); }
    });
  }

  if (!window.CROW_AUTH_LISTENER_INSTALLED) {
    window.CROW_AUTH_LISTENER_INSTALLED = true;
    sb.auth.onAuthStateChange((event, session) => {
      publish(event, session);
    });
  }
})();
