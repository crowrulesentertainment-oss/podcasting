# CrowRules Podcasting Studio

A multi-page HTML/CSS/JavaScript starter for a dark, gold-accented podcast recording studio.

## Included pages
- `index.html` — real microphone capture, timer, live input meter, waveform visualization, pause/resume, playback, and audio download. Add intro and/or ending songs, adjust their volume, and build a combined WAV episode in intro → voice → ending order.
- `projects.html` — view locally saved project details.
- `soundboard.html` — preview an audio file locally and organize cue categories.
- `export.html` — publishing checklist and copyable episode metadata.
- `settings.html` — browser capability checks and privacy notes.
- `styles.css` — responsive styling.
- `app.js` — browser recording logic.

## Run locally
Microphone access usually requires HTTPS or localhost. From this folder run:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in a current browser. Or deploy these static files to an HTTPS host such as GitHub Pages.

## Limitations
- Audio format depends on browser MediaRecorder support.
- Project metadata is saved locally by default and can also sync to Supabase after signing in.
- Recordings are held in memory until downloaded; download before refreshing or closing the page.
- Supabase Auth, cloud project metadata, private cloud audio storage, and a ready-for-show export queue are connected. Remote guest sessions, a true multitrack editor, AI processing, and automatic public podcast-host/RSS publishing are not included.
- Intro and ending songs can be combined with a completed voice take into a single WAV file. Separate intro/outro fades are supported. This is a simple sequential mix, not a full multitrack editor; music does not duck under speech and there are no timeline trimming controls. Audio mixing happens locally in the browser.

## Recommended next steps
1. Connect Supabase Auth and per-user project metadata.
2. Add private Storage buckets and secure uploads.
3. Enforce Row Level Security for user-owned projects.
4. Build non-destructive multitrack editing and export.
5. Connect finished projects to CrowRules Podcasting's episode publishing workflow.

## Privacy
Microphone capture starts only after the user clicks a recording or microphone-check control and grants permission. Audio is not uploaded unless you explicitly choose Send to my show or Both and are signed in. Cloud audio is stored in a private bucket with owner-scoped policies.


## Latest upgrade: music fades

The intro and ending music panels now include separate fade-in and fade-out controls (0–10 seconds). The mix renderer applies those fades to the exported WAV while keeping the original uploaded music and voice take unchanged. The current layout remains sequential: intro → voice recording → ending music.


## Supabase cloud connection

This version is configured for the CrowRules Entertainment Supabase project. `supabase-config.js` contains the project URL and a public publishable key; publishable keys are intended for browser use. Never place a `service_role` or secret key in front-end files.

### Cloud features
- Create an account or sign in with email/password from the Studio page. If email confirmation is enabled in Supabase Auth, confirm your email before signing in.
- Save project metadata to `crowrules_studio_projects`.
- Choose **Send to my show** to upload the finished WAV to the private `crowrules-podcast-studio` Storage bucket and create a `crowrules_studio_exports` draft. Choose **Both** to upload it and download a local copy.
- Recent cloud exports show in the Studio page; the app creates short-lived signed download links for your private files.

### Important publishing distinction
Sending an episode to the show workspace saves it as `ready_for_show`; it does not publish to a public RSS feed or modify `podcast_episodes`. Public publishing should be a separate, authenticated workflow that validates the selected show and publishing permissions.

### Database setup
The studio tables, private storage bucket, and owner-only row/storage policies were applied to the connected CrowRules Supabase project. `supabase-setup.sql` is included as a reference/recovery script. Do not run it blindly in another project without reviewing it first.

### Run locally
Serve this folder over `http://localhost` or HTTPS; do not rely on opening `index.html` directly from `file://`.
