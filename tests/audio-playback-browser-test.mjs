import { chromium } from "playwright";
const base="https://crowrulesentertainment-oss.github.io/podcasting/home.html";
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
try{
 await page.addInitScript(()=>{window.__crPlays=[];window.addEventListener("crowrules:play-recorded",e=>window.__crPlays.push(e.detail||{}))});
 await page.goto(base+"?audioIntegrityTest="+Date.now(),{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>window.CrowRulesAudioPlayer&&window.supabase&&window.CROW_CONFIG,null,{timeout:90000});
 const ep=await page.evaluate(async()=>{const db=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey);const {data,error}=await db.from("podcast_episodes").select("id,title,audio_url,podcast_id").eq("status","published").like("audio_url","https://%").limit(20);if(error)throw Error(error.message);if(!data?.length)throw Error("No published HTTPS audio episode");return data[0]});
 await page.evaluate(ep=>{window.__crTestEpisode=ep;const b=document.createElement("button");b.id="cr-audio-test-start";b.textContent="Start test playback";b.style.cssText="position:fixed;z-index:2147483647;top:8px;left:8px;padding:12px";b.onclick=()=>window.CrowRulesAudioPlayer.playQueue([window.__crTestEpisode],0);document.body.appendChild(b)},ep);
 await page.locator("#cr-audio-test-start").click();
 await page.waitForFunction(()=>{const p=window.CrowRulesAudioPlayer?.getState?.();return p&&!p.paused&&p.currentTime>=3},null,{timeout:45000,polling:250});
 await page.waitForFunction(id=>(window.__crPlays||[]).some(e=>e.episodeId===id),ep.id,{timeout:20000});
 const ev=await page.evaluate(id=>(window.__crPlays||[]).find(e=>e.episodeId===id),ep.id);
 if(!ev?.sessionKey)throw Error("Missing play event session key");
 const before=await page.evaluate(()=>window.CrowRulesAudioPlayer.getState());
 const link=page.locator('a[href*="rankings.html"]').first();
 if(await link.count()){await link.click();await page.waitForURL(/rankings\.html/,{timeout:20000})}else{await page.goto(base.replace("home.html","rankings.html")+"?audioIntegrityTest="+Date.now(),{waitUntil:"domcontentloaded",timeout:90000})}
 await page.waitForTimeout(2500);
 const after=await page.evaluate(()=>window.CrowRulesAudioPlayer?.getState?.());
 if(!after||after.paused||after.currentTime<=before.currentTime)throw Error("Audio failed to continue after rankings navigation: "+JSON.stringify({before,after}));
 await page.evaluate(()=>window.CrowRulesAudioPlayer.toggle());
 await page.waitForTimeout(1800);
 const row=await page.evaluate(async key=>{const db=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey);const {data,error}=await db.from("podcast_listens").select("id,episode_id,session_key,seconds_listened,completed,created_at").eq("session_key",key).limit(1).maybeSingle();return{data,error:error?{code:error.code,message:error.message}:null}},ev.sessionKey);
 console.log("PASS: audio playback advanced and continued after navigating to rankings.");
 console.log("PLAYBACK_TEST_EPISODE="+JSON.stringify({id:ep.id,title:ep.title}));
 console.log("PLAYBACK_TEST_SESSION_KEY="+ev.sessionKey);
 console.log("PLAYBACK_TEST_SESSION_READ="+JSON.stringify(row));
}catch(e){console.error("FAIL: "+(e?.stack||e));process.exitCode=1}finally{await context.close();await browser.close()}
