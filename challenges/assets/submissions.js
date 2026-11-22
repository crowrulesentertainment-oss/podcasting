import { sb } from "../../assets/js/client.js";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root=$("#challenge-submit"),status=$("#submit-status");
const say=(message,type="info")=>{status.textContent=message;status.dataset.type=type;};
const validUrl=value=>{try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)&&!!u.hostname}catch{return false}};
const dateText=value=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Los_Angeles"}).format(new Date(value))+" Pacific";
let user=null,events=[],submitting=false;
async function load(){
 root.innerHTML="";
 const auth=await sb.auth.getUser();
 if(auth.error)throw auth.error;
 user=auth.data.user;
 if(!user){say("Sign in to your CrowRules Podcasting account to submit an entry.");root.innerHTML='<div class="submit-panel"><h2>Creator sign-in required</h2><p class="panel-intro">Sign in first. Your submission and recognition history will be connected to your creator account.</p><a class="btn" href="../../login.html?next='+encodeURIComponent(location.pathname)+'">Sign in to CrowRules</a></div>';return}
 say("Checking your creator membership and available challenges…");
 const [creatorResult,eventResult,entryResult,profileResult]=await Promise.all([
  sb.from("podcast_creators").select("id,podcast_id,role,member_id").eq("user_id",user.id),
  sb.from("podcast_monthly_challenges").select("id,title,challenge_code,challenge_year,challenge_month,submission_opens_at,submission_closes_at,status,description,requirements").neq("status","draft").neq("status","archived").order("challenge_year").order("challenge_month"),
  sb.from("podcast_challenge_submissions").select("id,challenge_id,episode_title,status,submitted_at,episode_slug,published_at,public_display_consent").eq("creator_user_id",user.id).order("submitted_at",{ascending:false}),
  sb.from("creator_profiles").select("id,creator_id").eq("user_id",user.id).maybeSingle()
 ]);
 if(creatorResult.error)throw creatorResult.error;
 if(!creatorResult.data?.length){say("An active CrowRules Podcasting creator membership is required.","error");root.innerHTML='<div class="submit-panel"><h2>Creator account required</h2><p class="panel-intro">Join or create a podcast in CrowRules Podcasting, then return here to enter a creator challenge.</p><a class="btn" href="../../creator.html">Open Creator Studio</a></div>';return}
 if(eventResult.error)throw eventResult.error;
 if(entryResult.error)throw entryResult.error;
 events=eventResult.data||[];
 const entries=entryResult.data||[];
 if(!events.length){say("The Published challenge records could not be found. Please contact CrowRules support.","error");return}
 let creatorProfileId=profileResult.data?.creator_id||null;
 if(!creatorProfileId&&creatorResult.data[0].member_id){
  const creatorLink=await sb.from("creators").select("id").eq("member_id",creatorResult.data[0].member_id).limit(1).maybeSingle();
  if(!creatorLink.error)creatorProfileId=creatorLink.data?.id||null;
 }
 const studioShowsResult=creatorProfileId?await sb.from("podcasts").select("id,title").eq("creator_id",creatorProfileId):{data:[],error:null};
 if(studioShowsResult.error)throw studioShowsResult.error;
 const studioShows=studioShowsResult.data||[],studioShowMap=new Map(studioShows.map(x=>[x.id,x.title]));
 const studioShowIds=studioShows.map(x=>x.id);
 const studioEpisodeResult=studioShowIds.length?await sb.from("podcast_episodes").select("id,podcast_id,title,description,audio_url,video_url,thumbnail_url,status,is_published,published_at,access_level,production_stage").in("podcast_id",studioShowIds).order("created_at",{ascending:false}):{data:[],error:null};
 if(studioEpisodeResult.error)throw studioEpisodeResult.error;
 const studioEpisodes=(studioEpisodeResult.data||[]).filter(e=>e.access_level!=="premium"&&(e.audio_url||e.video_url));
 const used=new Set(entries.map(e=>e.challenge_id));
 const now=Date.now(),activeEvent=events.find(e=>e.status==="published"&&!used.has(e.id)&&now>=new Date(e.submission_opens_at).getTime()&&now<=new Date(e.submission_closes_at).getTime())||events.find(e=>e.status==="published"&&!used.has(e.id)&&now<=new Date(e.submission_closes_at).getTime())||events[0];
 const options=events.map(e=>'<option value="'+esc(e.id)+'"'+(e.id===activeEvent?.id?" selected":"")+'>'+esc(e.title)+(used.has(e.id)?" · Entry already submitted":"")+'</option>').join("");
 const studioEpisodeOptions=studioEpisodes.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.title)+' · '+esc(studioShowMap.get(e.podcast_id)||"Your show")+' · '+esc(e.status||"draft")+'</option>').join("");
 const rows=entries.map(e=>{
  const event=events.find(x=>x.id===e.challenge_id);
  return '<article class="entry-row"><div><strong>'+esc(e.episode_title)+'</strong><small>'+esc(event?.title||"Holiday challenge")+' · '+new Date(e.submitted_at).toLocaleDateString()+'</small></div><span class="entry-state">'+esc(e.status)+'</span></article>';
 }).join("");
 root.innerHTML='<div class="submit-layout"><section class="submit-panel"><div class="eyebrow">Official entry form · year-round challenge program</div><h2>Tell us about your episode</h2><p class="panel-intro">Publish your media first, then share its public URL below. You can submit one entry per creator for each pilot challenge.</p><form id="entry-form" class="challenge-form" novalidate>'+
 '<div class="field full"><label for="challenge-event">1. Choose your holiday challenge *</label><select id="challenge-event" required>'+options+'</select><div id="event-window" class="event-window" aria-live="polite"></div></div>'+
 '<div class="field full"><label for="entry-source">2. Where is your episode?</label><select id="entry-source"><option value="new">Upload a new file or add a public media link</option><option value="studio" '+(studioEpisodes.length?"":"disabled")+'>Select an episode already saved in Creator Studio ('+studioEpisodes.length+')</option></select><small class="upload-help">Choose an episode you have already recorded or uploaded in Creator Studio. You will not need to upload the media again.</small></div>'+
 '<div class="field full" id="studio-episode-field" hidden><label for="studio-episode">Choose an existing Creator Studio episode *</label><select id="studio-episode"><option value="">Choose one of your saved episodes</option>'+studioEpisodeOptions+'</select><small class="upload-help">Your saved audio or video will be attached directly to this challenge entry. Premium/private media is not eligible for this public review workflow.</small></div>'+
 '<div class="field"><label for="show-name">3. Podcast / show name *</label><input id="show-name" maxlength="160" required autocomplete="organization" placeholder="Your podcast or show name"></div>'+
 '<div class="field"><label for="episode-title">3. Challenge episode title *</label><input id="episode-title" maxlength="200" required placeholder="A title for your episode"></div>'+
 '<div class="field"><label for="media-type">4. Episode format *</label><select id="media-type" required><option value="audio">Upload an audio episode</option><option value="video">YouTube video</option><option value="external">Existing public audio / media link</option><option value="written">Written story / script link</option></select></div>'+
 '<div class="field full" id="audio-upload-field"><label for="audio-file">5. Upload your audio episode *</label><input class="file-input" id="audio-file" type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/wav,audio/ogg,audio/webm"><small class="upload-help">MP3, M4A, AAC, WAV, OGG or WebM · Maximum 500 MB. Your uploaded episode will receive a public playback link after upload.</small><div id="audio-preview" class="media-preview"></div></div>'+
 '<div class="field full" id="episode-url-field"><label for="episode-url">5. YouTube or public episode URL *</label><input id="episode-url" type="url" maxlength="1000" inputmode="url" placeholder="https://youtube.com/watch?v=…"><small id="episode-url-help">Paste a YouTube link or a public link reviewers can open. Private or unpublished links cannot be reviewed.</small><div id="youtube-preview" class="media-preview"></div></div>'+
 '<div class="field full"><label for="cover-file">6. Upload episode cover artwork (optional)</label><input class="file-input" id="cover-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small class="upload-help">JPG, PNG, WebP or GIF · Maximum 10 MB. Square artwork (recommended 1400 × 1400) looks best on creator profiles and challenge pages.</small><div id="cover-preview" class="media-preview"></div><label for="thumbnail-url">Or use an existing public artwork URL</label><input id="thumbnail-url" type="url" maxlength="1000" inputmode="url" placeholder="https://…"></div>'+
 '<div class="field full"><label for="creator-statement">7. Tell us how your entry connects to the challenge</label><textarea id="creator-statement" maxlength="1500" rows="4" placeholder="What inspired this episode? What would you like the review team and audience to know?"></textarea><small>Optional · Up to 1,500 characters</small></div>'+
 '<label class="consent"><input id="public-consent" type="checkbox"><span><b>Optional public Challenge Episode publishing permission</b><br>If checked, I authorize CrowRules Podcasting to display this submission on the relevant challenge page, the public Challenge Episode library, and my CrowRules creator profile if approved. If left unchecked, this entry remains private and is not eligible for public voting or public display. I retain ownership of my original work. This permission applies only to displaying this submitted entry on CrowRules. I understand I can contact CrowRules to request that public display be removed.</span></label>'+
 '<div class="form-actions"><button class="btn submit-btn" id="entry-submit" type="submit">Submit challenge entry</button><p id="submit-local-status" class="form-status" role="status" aria-live="polite"></p></div></form>'+
 '<div class="mt"><h2>Your submissions</h2><p class="panel-intro">Track review status for your entries across every challenge year.</p><div id="my-entries" class="entry-list">'+(rows||'<p class="muted">No challenge entries submitted yet.</p>')+'</div></div></section>'+
 '<aside class="submit-side"><article class="side-card"><div class="eyebrow">Before you submit</div><h3>Prepare your episode</h3><ul><li>Publish your audio or video first.</li><li>Check that the public link works without signing in.</li><li>Use an original entry that follows the challenge rules.</li><li>Submit before the event deadline.</li></ul><a href="../../creator.html?tab=studio" class="btn alt">Open Creator Studio</a></article><article class="side-card"><div class="eyebrow">Recognition</div><h3>Creator recognition</h3><p>Approved entries may qualify for challenge-specific creator recognition. Public-display consent controls episode publication; it does not determine historical participation recognition.</p><a href="../founding-creators/index.html">Read recognition rules →</a></article><article class="side-card"><div class="eyebrow">Need help?</div><h3>Submission guidelines</h3><p>Review the challenge requirements before sending your entry. Only one submission per creator per holiday pilot is accepted.</p><a href="../rules/index.html">Read challenge rules →</a></article></aside></div>';
 const form=$("#entry-form"),select=$("#challenge-event"),windowBox=$("#event-window"),submit=$("#entry-submit"),local=$("#submit-local-status"),mediaSelect=$("#media-type"),audioField=$("#audio-upload-field"),audioFile=$("#audio-file"),coverFile=$("#cover-file"),episodeInput=$("#episode-url"),coverPreview=$("#cover-preview"),audioPreview=$("#audio-preview"),youtubePreview=$("#youtube-preview");
 const sourceSelect=$("#entry-source"),studioEpisodeField=$("#studio-episode-field"),studioEpisodeSelect=$("#studio-episode"),showNameInput=$("#show-name"),episodeTitleInput=$("#episode-title");
 const getStudioEpisode=()=>studioEpisodes.find(e=>e.id===studioEpisodeSelect.value)||null;
 function applyEntrySource(){
  const fromStudio=sourceSelect.value==="studio",episode=getStudioEpisode();
  studioEpisodeField.hidden=!fromStudio;
  $("#show-name").closest(".field").hidden=fromStudio;
  $("#episode-title").closest(".field").hidden=fromStudio;
  $("#media-type").closest(".field").hidden=fromStudio;
  if(fromStudio&&episode){
   showNameInput.value=studioShowMap.get(episode.podcast_id)||"";
   episodeTitleInput.value=episode.title||"";
   mediaSelect.value=episode.video_url?"video":"audio";
   episodeInput.value=episode.video_url||episode.audio_url||"";
   $("#thumbnail-url").value=episode.thumbnail_url||"";
   audioFile.required=false;episodeInput.required=false;
  }else if(!fromStudio){
   showNameInput.value="";episodeTitleInput.value="";episodeInput.value="";$("#thumbnail-url").value="";
   audioFile.required=mediaSelect.value==="audio";episodeInput.required=mediaSelect.value!=="audio";
  }
  previewMedia();
 }
 sourceSelect.addEventListener("change",applyEntrySource);
 studioEpisodeSelect.addEventListener("change",applyEntrySource);

 function youtubeId(value){try{const u=new URL(value),host=u.hostname.replace(/^www\./,"");if(host==="youtu.be")return u.pathname.split("/").filter(Boolean)[0]||null;if(["youtube.com","m.youtube.com","music.youtube.com"].includes(host)){if(u.pathname==="/watch")return u.searchParams.get("v");const m=u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);return m?.[1]||null}}catch{}return null}
 function previewMedia(){const mode=mediaSelect.value,fromStudio=sourceSelect.value==="studio";audioField.hidden=fromStudio||mode!=="audio";$("#episode-url-field").hidden=fromStudio||mode==="audio";episodeInput.required=!fromStudio&&mode!=="audio";audioFile.required=!fromStudio&&mode==="audio";youtubePreview.innerHTML="";if(!fromStudio&&mode==="video"&&episodeInput.value.trim()){const id=youtubeId(episodeInput.value.trim());if(id)youtubePreview.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+esc(id)+'" title="YouTube episode preview" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';}}
 mediaSelect.addEventListener("change",previewMedia);episodeInput.addEventListener("input",previewMedia);
 audioFile.addEventListener("change",()=>{const f=audioFile.files?.[0];audioPreview.innerHTML="";if(f){const u=URL.createObjectURL(f);audioPreview.innerHTML='<audio controls preload="metadata" src="'+u+'"></audio>'}});
 coverFile.addEventListener("change",()=>{const f=coverFile.files?.[0];coverPreview.innerHTML="";if(f){const u=URL.createObjectURL(f);coverPreview.innerHTML='<img alt="Episode cover preview" src="'+u+'">'}});
 previewMedia();
 function updateWindow(){
  const event=events.find(x=>x.id===select.value);if(!event)return;
  const now=Date.now(),opens=new Date(event.submission_opens_at).getTime(),closes=new Date(event.submission_closes_at).getTime();
  const open=event.status==="published"&&now>=opens&&now<=closes,usedEntry=used.has(event.id);
  let label=usedEntry?"You already submitted an entry for this challenge.":open?"Submissions are OPEN.":now<opens?"Submissions have not opened yet.":"The submission window has closed.";
  windowBox.dataset.open=String(open);windowBox.innerHTML='<strong>'+label+'</strong>'+esc(dateText(event.submission_opens_at))+' – '+esc(dateText(event.submission_closes_at))+'<br>'+esc(event.requirements||"Please follow the published challenge guidelines.");
  submit.disabled=!open||usedEntry||submitting;
  submit.textContent=usedEntry?"Entry already submitted":open?"Submit challenge entry":now<opens?"Opens "+new Date(opens).toLocaleDateString():"Submission window closed";
 }
 select.addEventListener("change",updateWindow);updateWindow();
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();if(submitting)return;local.textContent="";local.dataset.type="";
  const challenge_id=select.value,source=sourceSelect.value,studioEpisode=source==="studio"?getStudioEpisode():null,show_name=studioEpisode?(studioShowMap.get(studioEpisode.podcast_id)||""):showNameInput.value.trim(),episode_title=studioEpisode?(studioEpisode.title||""):episodeTitleInput.value.trim(),episode_url=studioEpisode?(studioEpisode.video_url||studioEpisode.audio_url||""):episodeInput.value.trim(),creator_statement=$("#creator-statement").value.trim(),public_display_consent=$("#public-consent").checked,media_type=studioEpisode?(studioEpisode.video_url?"video":"audio"):mediaSelect.value,thumbnail_url=$("#thumbnail-url").value.trim(),audio=source==="studio"?null:(audioFile.files?.[0]||null),cover=coverFile.files?.[0]||null;
  if(source==="studio"&&!studioEpisode){local.textContent="Choose an existing episode from Creator Studio.";local.dataset.type="error";return}
  if(!show_name||!episode_title){local.textContent="Please complete your show name and episode title.";local.dataset.type="error";return}
  if(source==="new"&&media_type==="audio"&&!audio){local.textContent="Choose the audio file you want to submit.";local.dataset.type="error";return}
  if((source==="studio"||media_type!=="audio")&&!episode_url){local.textContent="The selected episode does not have a usable public media URL.";local.dataset.type="error";return}
  if((source==="studio"||media_type!=="audio")&&!validUrl(episode_url)){local.textContent="The selected episode media URL is not a valid public http or https link.";local.dataset.type="error";return}
  if(source==="new"&&media_type==="video"&&!youtubeId(episode_url)){local.textContent="Enter a valid YouTube video, Shorts, or live URL.";local.dataset.type="error";return}
  if(audio&&(audio.size>500*1024*1024||!audio.type.startsWith("audio/"))){local.textContent="Choose an audio file under 500 MB in a supported audio format.";local.dataset.type="error";return}
  if(cover&&(cover.size>10*1024*1024||!/^image\/(jpeg|png|webp|gif)$/.test(cover.type))){local.textContent="Choose a JPG, PNG, WebP or GIF cover image under 10 MB.";local.dataset.type="error";return}
  if(thumbnail_url&&!validUrl(thumbnail_url)){local.textContent="Enter a valid http or https artwork URL, or leave the optional field blank.";local.dataset.type="error";return}
  if(cover&&thumbnail_url){local.textContent="Choose an uploaded cover image or an artwork URL, not both.";local.dataset.type="error";return}
  const event=events.find(x=>x.id===challenge_id),now=Date.now();
  if(!event||event.status!=="published"||now<new Date(event.submission_opens_at).getTime()||now>new Date(event.submission_closes_at).getTime()){local.textContent="This challenge is not accepting entries yet. Check the submission dates above.";local.dataset.type="error";updateWindow();return}
  if(used.has(challenge_id)){local.textContent="You already submitted an entry for this challenge.";local.dataset.type="error";updateWindow();return}
  submitting=true;submit.disabled=true;submit.textContent="Submitting securely…";
  try{
   let finalEpisodeUrl=episode_url,finalThumbnailUrl=thumbnail_url||(studioEpisode?.thumbnail_url||null);
   const safeName=f=>f.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100)||"media";
   if(audio){const path=user.id+"/challenge-episodes/"+challenge_id+"/"+Date.now()+"-"+safeName(audio);const uploaded=await sb.storage.from("crowrules-podcast-published").upload(path,audio,{contentType:audio.type,cacheControl:"3600",upsert:false});if(uploaded.error)throw uploaded.error;finalEpisodeUrl=sb.storage.from("crowrules-podcast-published").getPublicUrl(uploaded.data.path).data.publicUrl;}
   if(cover){const path=user.id+"/challenge-covers/"+challenge_id+"/"+Date.now()+"-"+safeName(cover);const uploaded=await sb.storage.from("cr-podcast-artwork").upload(path,cover,{contentType:cover.type,cacheControl:"3600",upsert:false});if(uploaded.error)throw uploaded.error;finalThumbnailUrl=sb.storage.from("cr-podcast-artwork").getPublicUrl(uploaded.data.path).data.publicUrl;}
   const payload={challenge_id,creator_user_id:user.id,creator_id:creatorProfileId,show_name,episode_title,episode_url:finalEpisodeUrl,creator_statement:creator_statement||"",public_display_consent,media_type,thumbnail_url:finalThumbnailUrl,status:"pending"};
   const result=await sb.from("podcast_challenge_submissions").insert(payload).select("id,challenge_id,episode_title,status,submitted_at").single();
   if(result.error)throw result.error;
   used.add(challenge_id);say("Your challenge entry has been received and is awaiting review.","success");
   local.textContent="Submission received. You can track its review status below.";local.dataset.type="success";
   const item=result.data;
   $("#my-entries").insertAdjacentHTML("afterbegin",'<article class="entry-row"><div><strong>'+esc(item.episode_title)+'</strong><small>'+esc(event.title)+' · '+new Date(item.submitted_at).toLocaleDateString()+'</small></div><span class="entry-state">pending</span></article>');
   updateWindow();
  }catch(error){
   console.error("Challenge submission failed",error);
   local.textContent=error.code==="23505"?"An entry for this challenge has already been submitted from your creator account.":error.code==="42501"?"Your account is not currently authorized to submit this entry. Confirm that your creator membership is active and the challenge window is open.":error.message||"We could not submit your entry. Please try again.";
   local.dataset.type="error";
  }finally{submitting=false;updateWindow();}
 });
 say("Your creator account is ready. Review the dates and complete the form when submissions open.","success");
}
load().catch(error=>{console.error("Challenge submission page failed",error);say("We could not load the submission form: "+(error.message||"Please refresh and try again."),"error");root.innerHTML='<div class="submit-panel"><h2>We could not load your form</h2><p class="panel-intro">Please refresh this page. If the problem continues, contact CrowRules support and include the error message shown above.</p><a class="btn alt" href="../index.html">Return to Challenge Hub</a></div>';});
