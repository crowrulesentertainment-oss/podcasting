/* =========================================================
   CROWRULES PODCASTING — UNIVERSAL MEMBERSHIP HEADER
   Adds Universal CrowRules Membership controls beside the Dreamscapes support link.
   ========================================================= */
(function(){
  "use strict";
  const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
  const SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  function prefix(){
    const parts=location.pathname.split("/").filter(Boolean);
    return parts.length>1 ? "../".repeat(Math.max(0,parts.length-2)) : "";
  }
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

  function style(){
    if(document.getElementById("cr-pod-membership-style"))return;
    const s=document.createElement("style");
    s.id="cr-pod-membership-style";
    s.textContent=`
      .cr-pod-membership{display:inline-flex!important;align-items:center!important;gap:7px!important;margin-left:2px!important;white-space:nowrap!important}
      .cr-pod-membership a{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:36px!important;padding:7px 11px!important;border-radius:999px!important;text-decoration:none!important;font:800 .72rem/1 Montserrat,Arial,sans-serif!important;letter-spacing:.05em!important;text-transform:uppercase!important}
      .cr-pod-membership-link{color:#9ea6bf!important;border:1px solid rgba(255,255,255,.09)!important;background:rgba(255,255,255,.03)!important}
      .cr-pod-membership-cta{color:#05050b!important;border:1px solid rgba(0,229,255,.4)!important;background:linear-gradient(135deg,#00e5ff,#8b5cff)!important}
      .cr-pod-plan{display:inline-flex;align-items:center;min-height:30px;padding:5px 8px;border:1px solid rgba(54,226,155,.2);border-radius:999px;color:#36e29b;font:800 .65rem/1 Montserrat,Arial,sans-serif;text-transform:uppercase}
      @media(max-width:760px){.cr-pod-membership{width:100%!important;margin-left:0!important}.cr-pod-membership a{flex:1!important}}
    `;
    document.head.appendChild(s);
  }

  function render(authenticated,membership,user){
    const nav=document.querySelector(".navlinks");
    if(!nav)return;
    style();
    const p=prefix();
    let donate=nav.querySelector("[data-cr-pod-donate]");
    if(!donate){
      donate=document.createElement("a");
      donate.href="https://crowrulesentertainment-oss.github.io/dreamscapes/donation.html";
      donate.textContent="Support the Dream";
      donate.dataset.crPodDonate="1";
      nav.appendChild(donate);
    }
    let box=document.getElementById("cr-pod-membership");
    if(!box){
      box=document.createElement("span");
      box.id="cr-pod-membership";
      box.className="cr-pod-membership";
      donate.insertAdjacentElement("afterend",box);
    }
    const plan=membership?.plan_name||membership?.display_name||membership?.plan_key||"";
    if(!authenticated){
      box.innerHTML='<a class="cr-pod-membership-link" href="'+esc(p+"membership.html")+'">Membership</a><a class="cr-pod-membership-cta" href="'+esc(p+"login.html")+'">JOIN CROWRULES</a>';
      return;
    }
    box.innerHTML=(plan?'<span class="cr-pod-plan">'+esc(plan)+'</span>':"")+
      '<a class="cr-pod-membership-link" href="'+esc(p+"membership.html")+'">Membership</a>'+
      '<a class="cr-pod-membership-cta" href="'+esc(p+"creator/dashboard.html")+'">CREATOR</a>';
  }

  async function load(){
    try{
      if(!window.supabase){
        await new Promise((resolve,reject)=>{
          const s=document.createElement("script");
          s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
        });
      }
      const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      const {data:{session}}=await client.auth.getSession();
      if(!session){render(false,null,null);return;}
      let membership=null;
      try{
        const r=await fetch(SUPABASE_URL+"/functions/v1/membership-status",{headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY}});
        if(r.ok)membership=(await r.json())?.membership||null;
      }catch(e){console.warn("[CrowRules Membership]",e);}
      render(true,membership,session.user);
      client.auth.onAuthStateChange((event,next)=>{
        setTimeout(()=>render(!!next,membership,next?.user||null),0);
      });
    }catch(e){
      console.warn("[CrowRules Membership] Header integration:",e);
      render(false,null,null);
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();