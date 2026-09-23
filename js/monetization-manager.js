/* CrowRules Podcasting — Monetization Manager 3.1
   Browser-safe controller. Never place Stripe secret/restricted keys here.
   Server-side Checkout + webhooks should consume these product identifiers.
*/
window.CrowRulesMonetization={
 version:"3.1",
 channels:["membership","listener_support","sponsorship","advertising","affiliate","digital_products"],
 moneyStates:["projected","agreed","pending","paid","refunded","paid_out"],
 checkout:"server-side",
 webhook:"server-side",
 security:{
   stripeSecrets:"server-only",
   webhookVerification:"server-only",
   rls:"required"
 },
 formatUSD(cents){
   return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((Number(cents)||0)/100);
 },
 stateLabel(state){
   return String(state||"projected").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
 }
};
