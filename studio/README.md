# CrowRules Podcasting Studio

A multi-page HTML/CSS/JavaScript starter for a dark, gold-accented podcast recording studio.

## Included pages
- `index.html` — real microphone capture, timer, live input meter, waveform visualization, pause/resume, playback, and audio download.
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
- Project metadata is stored in localStorage on this browser.
- Recordings are held in memory until downloaded; download before refreshing or closing the page.
- Supabase, authentication, cloud storage, remote guest sessions, a true multitrack editor, AI processing, and automatic podcast-host publishing are not connected.
- Soundboard files can be previewed but are not inserted into a multitrack timeline.

## Recommended next steps
1. Connect Supabase Auth and per-user project metadata.
2. Add private Storage buckets and secure uploads.
3. Enforce Row Level Security for user-owned projects.
4. Build non-destructive multitrack editing and export.
5. Connect finished projects to CrowRules Podcasting's episode publishing workflow.

## Privacy
Microphone capture starts only after the user clicks a recording or microphone-check control and grants permission. This prototype does not upload audio to a server.
