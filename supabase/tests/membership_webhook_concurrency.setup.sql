\set ON_ERROR_STOP on
CREATE SCHEMA webhook_race_it;
CREATE TABLE webhook_race_it.events (
  event_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('processing','processed','failed'))
);
CREATE OR REPLACE FUNCTION webhook_race_it.claim(p_id text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO webhook_race_it.events(event_id,status)
  VALUES(p_id,'processing') ON CONFLICT DO NOTHING;
  IF FOUND THEN
    PERFORM pg_sleep(1);
    RETURN 'claimed';
  END IF;
  IF (SELECT status FROM webhook_race_it.events WHERE event_id=p_id)='processed'
    THEN RETURN 'processed'; END IF;
  RETURN 'busy';
END $$;
