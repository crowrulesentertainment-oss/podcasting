# CrowRules Podcasting Seasonal Theme System

## Purpose

Seasonal releases should feel like a complete, polished experience without replacing the podcast platform or creating a separate application. Christmas 2026 is the first full seasonal presentation. Future Halloween, Thanksgiving, Valentine's Day, New Year and other releases should reuse the same foundation.

## Existing shared foundation

- `assets/js/theme-catalog.js` is the catalog of supported seasonal and cinematic environments.
- `assets/js/site-theme.js` resolves the featured theme and member preference, applies scene and color variables, and supports scheduled or automatic seasonal themes.
- `crp_site_settings` controls the platform featured theme and seasonal schedule.
- `crp_theme_preferences` stores a member's personal theme choice.

Do not introduce a second theme resolver or overwrite member preferences when a featured seasonal experience changes.

## Seasonal enhancement contract

Each holiday-specific experience may add:
- A small page-wide seasonal ribbon and a dedicated seasonal destination.
- A home-page feature panel that is inserted only when the corresponding season is active.
- Optional page-specific atmospheres, such as a Creator Studio environment.
- Accessible seasonal interactions and content collections.

Keep the enhancement isolated in a holiday-specific module and stylesheet. Use the existing theme runtime as the source of truth for featured themes. A preview query parameter may activate the visual treatment for QA, but preview mode must not save a theme preference or write to Supabase.

## Visual and accessibility rules

- Use shared CSS variables and a consistent token palette for each season.
- Prefer realistic scenery and restrained motion over decorative clutter.
- Respect `prefers-reduced-motion`; all seasonal effects must be nonessential.
- Keep navigation, forms, media players, creator workflows and controls readable and functional.
- Make all visual layouts responsive for mobile and desktop.
- Provide meaningful alt text and source/credit links for third-party imagery.

## Data and security rules

- A visual seasonal release should not require a database migration.
- Do not change authentication, RLS, storage permissions, accounts, shows, episodes, uploads, playback or creator permissions for a theme-only release.
- If a future holiday feature needs persistent submissions, votes, gifts or community content, design and review its own schema, moderation and RLS separately before implementation.
- Never place Supabase service-role keys, payment secrets or server credentials in browser assets.

## Christmas 2026 implementation

- Module: `assets/js/christmas-experience.js`
- Styles: `assets/css/christmas-experience.css`
- Destination: `christmas/index.html`
- App integration: loaded by `assets/js/app.js`
- Standalone live page integration: `live/index.html`
- Public seasonal window: December 1–25, 2026
- QA preview: `?seasonalPreview=christmas` on app pages; `?preview=1` on the Advent Calendar to unlock all days.

The seasonal layer is additive. It does not modify member theme preference records or podcast data.
