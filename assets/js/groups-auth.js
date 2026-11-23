import { sb } from "./client.js";
import { SITE_BASE } from "./config.js";

const header = document.querySelector("body[data-groups-page] header");
if (header) {
  let actions = header.querySelector(".header-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "actions header-actions";
    header.append(actions);
  }
  actions.classList.add("groups-auth-actions");
  actions.setAttribute("aria-live", "polite");
  actions.setAttribute("aria-label", "Account status");

  const link = (label, href, className = "btn") => {
    const node = document.createElement("a");
    node.className = className;
    node.href = href;
    node.textContent = label;
    return node;
  };

  function render(user) {
    actions.replaceChildren();
    if (!user) {
      actions.append(
        link("Sign in", SITE_BASE + "login.html", "btn secondary"),
        link("Join free", SITE_BASE + "signup.html", "btn")
      );
      actions.dataset.authState = "signed-out";
      return;
    }

    const state = document.createElement("span");
    state.className = "groups-auth-label";
    state.textContent = "Signed in";
    state.title = "You are signed in to your CrowRules Podcasting account.";
    actions.append(
      state,
      link("Account", SITE_BASE + "account.html", "btn secondary"),
    );

    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.className = "btn groups-signout";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", async () => {
      signOut.disabled = true;
      signOut.textContent = "Signing out…";
      const { error } = await sb.auth.signOut();
      if (error) {
        signOut.disabled = false;
        signOut.textContent = "Sign out";
        state.textContent = "Sign-out failed";
        state.title = error.message || "Your session could not be ended.";
      }
    });
    actions.append(signOut);
    actions.dataset.authState = "signed-in";
  }

  function renderUnavailable(error) {
    actions.replaceChildren();
    const state = document.createElement("span");
    state.className = "groups-auth-label";
    state.textContent = "Account status unavailable";
    state.title = error?.message || "Supabase Auth could not verify the current session.";
    actions.append(state, link("Try sign in", SITE_BASE + "login.html", "btn secondary"));
    actions.dataset.authState = "unavailable";
  }

  actions.dataset.authState = "checking";
  const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
    render(session?.user || null);
  });

  sb.auth.getUser().then(({ data, error }) => {
    if (error) renderUnavailable(error);
    else render(data.user || null);
  }).catch(renderUnavailable);

  window.addEventListener("pagehide", () => authListener.subscription.unsubscribe(), { once: true });
}
