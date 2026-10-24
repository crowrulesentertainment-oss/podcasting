-- Expand accepted media formats for the private Creator Studio bucket only.
-- The bucket remains private and existing owner-folder Storage policies remain in force.
update storage.buckets
set allowed_mime_types = array[
  'audio/wav','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/aac','audio/flac','audio/x-m4a','audio/m4a',
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm',
  'text/plain','text/vtt','application/pdf','application/x-subrip'
]
where id = 'crowrules-podcast-studio' and public = false;
