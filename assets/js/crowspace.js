import { sb } from "./client.js";
import { SITE_BASE } from "./config.js";

const root = document.querySelector("#crowspaceIdentity");
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

async function start() {
  if (!root) return;
  try {
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      root.innerHTML = `
        <div class="cs-identity-copy">
          <span class="cs-eyebrow">YOUR SPACE STARTS HERE</span>
          <h3>One CrowRules account. Your whole community.</h3>
          <p>Sign in with your existing CrowRules Podcasting account. You do not need to create a separate CrowSpace login.</p>
        </div>
        <a class="cs-primary" href="${SITE_BASE}account.html">Sign in / Join CrowRules</a>`;
      return;
    }

    const [{ data: link, error: linkError }, { data: profile, error: profileError }] = await Promise.all([
      sb.from("crowspace_account_links").select("auth_user_id,member_id,linked_at").eq("auth_user_id", user.id).maybeSingle(),
      sb.from("podcast_member_profiles").select("username,display_name,avatar_url,tagline").eq("user_id", user.id).maybeSingle()
    ]);
    if (linkError) throw linkError;
    if (profileError) throw profileError;

    if (!link) {
      root.innerHTML = `
        <div class="cs-identity-copy">
          <span class="cs-eyebrow">ACCOUNT FOUND · MEMBER LINK PENDING</span>
          <h3>Your sign-in is recognized.</h3>
          <p>This account does not yet have a linked Podcasting member record. Please open Account Center or contact CrowRules support; do not create another account.</p>
        </div>
        <a class="cs-primary" href="${SITE_BASE}account.html">Open Account Center</a>`;
      return;
    }

    const name = profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "CrowRules member";
    const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const profileUrl = profile?.username ? `${SITE_BASE}profile.html?username=${encodeURIComponent(profile.username)}` : `${SITE_BASE}account.html`;
    const [{ count: postCount }, { count: followerCount }] = await Promise.all([
      sb.from("podcast_member_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      sb.from("podcast_member_follows").select("id", { count: "exact", head: true }).eq("followed_user_id", user.id)
    ]);

    root.innerHTML = `
      <div class="cs-member">
        <div class="cs-avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`}</div>
        <div class="cs-identity-copy">
          <span class="cs-eyebrow"><i></i> MEMBER ACCOUNT CONNECTED</span>
          <h3>${esc(name)}</h3>
          <p>${esc(profile?.tagline || "Your CrowRules Podcasting identity is connected to CrowSpace.")}</p>
          <div class="cs-stats"><span><b>${Number(postCount || 0)}</b> POSTS</span><span><b>${Number(followerCount || 0)}</b> FOLLOWERS</span><span><b>1</b> ACCOUNT</span></div>
        </div>
      </div>
      <div class="cs-identity-actions"><a class="cs-primary" href="${esc(profileUrl)}">View my profile</a><a class="cs-secondary" href="${SITE_BASE}account.html">Edit account</a></div>`;
  } catch (error) {
    console.error("CrowSpace identity could not load:", error);
    root.innerHTML = `<div class="cs-identity-copy"><h3>We couldn't load your account right now.</h3><p>${esc(error.message || "Please refresh and try again.")}</p></div><a class="cs-secondary" href="${SITE_BASE}account.html">Open Account Center</a>`;
  }
}

start();
