# CrowRules Video Creation Studio

Browser-based video capture workspace styled to fit CrowRules Podcasting's dark creator studio with gold accents.

## Included
- Camera + microphone recording and screen/window capture
- Pause/resume, preview, and local WebM/MP4 download (browser-dependent)
- Sign in/out with the existing CrowRules Supabase Auth project
- Show selection for linked creator profiles (`members` → `creators` → `podcasts`)
- Local project saves when signed out; cloud project metadata when signed in
- Project notes, saved-project list, asset list, and simple visual asset sequence
- Optional private Supabase Storage upload for recorded takes

## Deploy
1. Upload this folder into the `podcasting` GitHub repository, for example as `video-studio/`.
2. The `supabase-config.js` file is prefilled with the public browser URL/key currently used by CrowRules Podcasting. Do not add a service-role key to browser code.
3. Run `supabase-schema.sql` in the Supabase SQL Editor to create the project table, row-level-security policies, and private storage bucket.
4. Visit `/podcasting/video-studio/` over HTTPS and sign in with your CrowRules account.

## Notes
- Camera/screen permissions require HTTPS or localhost.
- The `studio-videos` bucket is private. Uploading a file does not publish a video publicly or create an episode.
- The studio can save project details locally without the SQL setup; cloud projects and uploads require the schema above.
- The current version captures and downloads takes and tracks imported assets. It is not a full nonlinear editor: trimming, transitions, multi-track mixing, and rendering multiple imported sources into a single edited film are not included yet.
- Large uploads may need resumable/TUS upload support depending on your Supabase limits and recording size.
