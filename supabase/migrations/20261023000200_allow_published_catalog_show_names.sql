-- Keep Guests Lounge compatible with the published show catalog.
-- The page populates show choices from public.podcasts where status = 'published'.
-- These constraints validate safe display lengths; the public client validates the selected title against that catalog.
ALTER TABLE public.cr_guest_applications
  DROP CONSTRAINT IF EXISTS cr_guest_applications_show_name_check;
ALTER TABLE public.cr_guest_applications
  ADD CONSTRAINT cr_guest_applications_show_name_check
  CHECK (char_length(btrim(show_name)) BETWEEN 1 AND 120);

ALTER TABLE public.cr_lounge_messages
  DROP CONSTRAINT IF EXISTS cr_lounge_messages_show_name_check;
ALTER TABLE public.cr_lounge_messages
  ADD CONSTRAINT cr_lounge_messages_show_name_check
  CHECK (char_length(btrim(show_name)) BETWEEN 1 AND 120);
