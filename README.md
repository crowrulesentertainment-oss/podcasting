# CrowRules Podcasting

Multi-page, audio-first podcast platform for CrowRules Entertainment.

Supabase provides Auth, Postgres, RLS and Storage. Stripe subscription Checkout is intended to run through a Supabase Edge Function so secret Stripe credentials stay server-side. Configure the publishable key in js/config.js and apply supabase/schema.sql.