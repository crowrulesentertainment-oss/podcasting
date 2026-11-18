-- Remove the initial overload before any page-view clients were enabled.
-- The seven-argument function reads geo from the existing live-presence session.
drop function if exists public.podcasting_record_page_view(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric);
