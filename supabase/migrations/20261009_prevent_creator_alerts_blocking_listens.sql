-- Creator activity alerts reference auth.users. Older creator records can
-- predate a matching users row; notification side effects must not block plays.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef('private.cr_creator_activity_alert_trigger()'::regprocedure);
  v_definition := replace(
    v_definition,
    'if v_creator is null then return NEW; end if;',
    'if v_creator is null or not exists (select 1 from auth.users u where u.id = v_creator) then return NEW; end if;'
  );
  v_definition := replace(
    v_definition,
    'if NEW.creator_id is null then return NEW; end if;',
    'if NEW.creator_id is null or not exists (select 1 from auth.users u where u.id = NEW.creator_id) then return NEW; end if;'
  );
  EXECUTE v_definition;
END
$migration$;
