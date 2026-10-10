-- Listening rewards and challenge progress must only use authenticated member sessions.
-- The SECURITY DEFINER RPC writes to podcast_listens, so anon EXECUTE would bypass
-- the table's deliberately restricted anonymous INSERT policy.
REVOKE ALL ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean)
  TO authenticated, service_role;
