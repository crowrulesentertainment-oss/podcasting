# CrowRules Podcasting

Fresh GitHub Pages layout for **CrowRules Podcasting — Your Voice. Your Story. Your Universe.**

## Structure

- Root HTML files are public routes.
- `css/` contains the shared visual system and canonical navigation.
- `js/` contains shared Supabase/member services.
- `.github/workflows/` contains Pages deployment.
- No page owns a second navigation header; `js/global-navigation.js` mounts the single canonical header.

GitHub Pages supports ordinary static HTML/CSS/JavaScript files and requires an entry file such as `index.html` at the publishing root.