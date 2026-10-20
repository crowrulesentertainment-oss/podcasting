# CrowRules Podcasting Studio

A multi-page HTML/CSS/JavaScript starter for a dark, gold-accented podcast recording studio.

## Included pages
- `index.html` — real microphone capture, timer, live input meter, waveform visualization, pause/resume, playback, and audio download. Add intro and/or ending songs, adjust their volume, and build a combined WAV episode in intro → voice → ending order.
- `projects.html` — Supabase-backed private saved-project library with Open in Studio links.
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
- Project metadata is saved locally and in Supabase after signing in; show selection is based on the signed-in creator profile.
- Recordings are held in memory until downloaded; download before refreshing or closing the page.
- Supabase Auth session reuse, owner-scoped cloud project metadata, private draft audio storage, and publishing directly to the selected CrowRules podcast are connected. Publishing inserts a real `podcast_episodes` row and uploads public audio. External podcast-directory distribution is separate.
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


## Show selection, saved projects, and publishing upgrade

- The Studio show dropdown is loaded from the signed-in user's `members` → `creators` → `podcasts` relationship; it does not let a user choose another creator's show.
- Save Project writes to `crowrules_studio_projects`; the saved-project dropdown restores title, show, and notes. The Projects page lists cloud-saved sessions and links back to the selected project.
- **Save draft to selected show** uploads to the private `crowrules-podcast-studio` bucket and creates a `ready_for_show` export.
- **Publish episode to selected show** (or **Publish + download**) uploads a WAV to the public `crowrules-podcast-published` bucket and inserts a published row in `podcast_episodes` with that selected `podcast_id` and public `audio_url`. The parent show must already be published.
- Sign in through the main CrowRules Podcasting account page first; the Studio reuses the Supabase browser session. Never put a service-role key in front-end files.
- The public audio URL is internet-accessible once published. Only publish audio and music you have the rights to distribute.
