import { sb } from "./client.js";

const authNode = document.querySelector("#mp-auth");
const controls = document.querySelector("#mp-controls");
const checkbox = document.querySelector("#mp-optin");
const save = document.querySelector("#mp-save");
const status = document.querySelector("#mp-status");

async function init() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) {
    authNode.textContent = "Please sign in to manage your promotional email preferences.";
    const link = document.createElement("a");
    link.href = "login.html?redirect=marketing-preferences.html";
    link.textContent = "Sign in to continue";
    link.style.cssText = "display:inline-block;margin-top:10px;color:#e7c46d";
    authNode.append(document.createElement("br"), link);
    return;
  }
  const { data, error: loadError } = await sb.functions.invoke("podcasting-marketing-preferences", { body: { action: "status" } });
  if (loadError || data?.error) {
    authNode.textContent = "We could not load your preferences. Please refresh and try again.";
    return;
  }
  checkbox.checked = data?.consented === true;
  authNode.textContent = "Signed in as " + (user.email || "your CrowRules account");
  controls.classList.remove("mp-hidden");
  status.textContent = checkbox.checked ? "You are currently subscribed to promotional emails." : "You are currently not subscribed to promotional emails.";
}
save.addEventListener("click", async () => {
  save.disabled = true;
  save.textContent = "Saving…";
  status.textContent = "Updating your preference…";
  try {
    const { data, error } = await sb.functions.invoke("podcasting-marketing-preferences", {
      body: checkbox.checked ? { action: "subscribe", confirm: true } : { action: "unsubscribe" }
    });
    if (error || data?.error) throw error || new Error(data.error);
    status.textContent = checkbox.checked
      ? "Your promotional email opt-in has been saved."
      : "You are unsubscribed from promotional emails.";
  } catch (error) {
    status.textContent = error?.message || "Could not save your preference. Please try again.";
  } finally {
    save.disabled = false;
    save.textContent = "Save preferences";
  }
});
init().catch(error => {
  authNode.textContent = error?.message || "Could not load your preferences.";
});