import { chromium } from "playwright";
const base="https://crowrulesentertainment-oss.github.io/podcasting/home.html";
const browser=await chromium.launch({headless:true,args:["--autoplay-policy=no-user-gesture-required"]});
const context=await browser.newContext();
const page=await context.newPage();
const browserDiagnostics=[];
page.on("console",msg=>{if(msg.type()==="error"||msg.text().includes("CrowRules"))browserDiagnostics.push({type:msg.type(),text:msg.text()})});
page.on("pageerror",error=>browserDiagnostics.push({type:"pageerror",text:error.message}));
try{
 await page.addInitScript(()=>{window.__crPlays=[];window.addEventListener("crowrules:play-recorded",e=>window.__crPlays.push(e.detail||{}))});
 await page.goto(base+"?audioIntegrityTest="+Date.now(),{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>window.CrowRulesAudioPlayer&&window.supabase&&window.CROW_CONFIG,null,{timeout:90000});
 const ep=await page.evaluate(async()=>{const db=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey);const {data,error}=await db.from("podcast_episodes").select("id,title,audio_url,podcast_id").eq("status","published").like("audio_url","https://%").limit(20);if(error)throw Error(error.message);if(!data?.length)throw Error("No published HTTPS audio episode");return data[0]});
 await page.evaluate(ep=>{window.__crTestEpisode=ep;const b=document.createElement("button");b.id="cr-audio-test-start";b.textContent="Start test playback";b.style.cssText="position:fixed;z-index:2147483647;top:8px;left:8px;padding:12px";b.onclick=()=>window.CrowRulesAudioPlayer.playQueue([{...window.__crTestEpisode,url:window.__crTestEpisode.audio_url,episodeId:window.__crTestEpisode.id,podcastId:window.__crTestEpisode.podcast_id,title:window.__crTestEpisode.title}],0);document.body.appendChild(b)},ep);
 await page.locator("#cr-audio-test-start").click();
 await page.waitForFunction(()=>{const p=window.CrowRulesAudioPlayer?.getState?.();return p&&!p.paused&&p.currentTime>=3},null,{timeout:45000,polling:250}).catch(async error=>{const diagnostic=await page.evaluate(()=>({player:window.CrowRulesAudioPlayer?.getState?.(),playerMessage:document.querySelector("#cr-ga-artist")?.textContent,playEvents:window.__crPlays||[],browserDiagnostics}));throw Error("Playback did not advance to 3 seconds. Diagnostics="+JSON.stringify(diagnostic)+"; "+error.message)});
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
 console.log("PLAYBACK_TEST_SESSION_PUBLIC_READ="+JSON.stringify(row));
 console.log("NOTE: podcast_listens has owner-only SELECT RLS; verify row with privileged SQL if public read returns null.");
 console.log("BROWSER_DIAGNOSTICS="+JSON.stringify(browserDiagnostics));
}catch(e){console.error("FAIL: "+(e?.stack||e));process.exitCode=1}finally{await context.close();await browser.close()}
