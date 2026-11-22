\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA webhook_it;
SET search_path = webhook_it, public;

CREATE TABLE webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_created_at bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('received','processing','processed','failed')),
  attempts integer NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE OR REPLACE FUNCTION claim_event(p_id text, p_type text, p_created bigint)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  INSERT INTO webhook_events(stripe_event_id,event_type,stripe_created_at,status)
  VALUES (p_id,p_type,p_created,'processing')
  ON CONFLICT DO NOTHING;
  IF FOUND THEN RETURN 'claimed'; END IF;

  SELECT status INTO v_status FROM webhook_events WHERE stripe_event_id=p_id FOR UPDATE;
  IF v_status='processed' THEN RETURN 'processed'; END IF;
  IF v_status='failed' THEN
    UPDATE webhook_events SET status='processing', attempts=attempts+1
    WHERE stripe_event_id=p_id;
    RETURN 'claimed';
  END IF;
  RETURN 'busy';
END $$;

CREATE OR REPLACE FUNCTION finish_event(p_id text, p_status text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_status NOT IN ('processed','failed') THEN
    RAISE EXCEPTION 'invalid terminal status';
  END IF;
  UPDATE webhook_events
  SET status=p_status,
      processed_at=CASE WHEN p_status='processed' THEN now() ELSE NULL END
  WHERE stripe_event_id=p_id AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'event not claimed or no longer processing'; END IF;
END $$;

CREATE TABLE subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  plan_key text NOT NULL,
  site_key text,
  status text NOT NULL,
  created_at bigint NOT NULL,
  last_event_created bigint NOT NULL
);

CREATE OR REPLACE FUNCTION upsert_subscription_guarded(
  p_id text,p_user text,p_plan text,p_site text,p_status text,p_created bigint
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_existing bigint;
BEGIN
  SELECT last_event_created INTO v_existing
  FROM subscriptions WHERE id=p_id FOR UPDATE;
  IF FOUND AND p_created <= v_existing THEN RETURN false; END IF;

  INSERT INTO subscriptions(id,user_id,plan_key,site_key,status,created_at,last_event_created)
  VALUES(p_id,p_user,p_plan,p_site,p_status,p_created,p_created)
  ON CONFLICT(id) DO UPDATE SET
    user_id=EXCLUDED.user_id, plan_key=EXCLUDED.plan_key,
    site_key=EXCLUDED.site_key, status=EXCLUDED.status,
    last_event_created=EXCLUDED.last_event_created;
  RETURN true;
END $$;

CREATE TABLE members (
  user_id text PRIMARY KEY,
  membership_type text NOT NULL DEFAULT 'Free',
  status text NOT NULL DEFAULT 'Active'
);

CREATE OR REPLACE FUNCTION sync_global_member(p_user text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_plan text; v_status text;
BEGIN
  SELECT plan_key,status INTO v_plan,v_status
  FROM subscriptions
  WHERE user_id=p_user AND site_key IS NULL
  ORDER BY CASE WHEN status IN ('active','pending') THEN 0 ELSE 1 END,
           created_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    UPDATE members SET membership_type='Free',status='Active' WHERE user_id=p_user;
    RETURN;
  END IF;

  UPDATE members SET
    membership_type=CASE v_plan
      WHEN 'founder' THEN 'Owner'
      WHEN 'creator' THEN 'Creator'
      WHEN 'crowner' THEN 'Pro'
      ELSE 'Free' END,
    status=CASE WHEN v_status IN ('active','pending') THEN 'Active' ELSE 'Suspended' END
  WHERE user_id=p_user;

  IF NOT FOUND THEN
    UPDATE members SET membership_type='Free',status='Active' WHERE user_id=p_user;
  END IF;
END $$;

DO $$
DECLARE v text; ok boolean; m members%ROWTYPE;
BEGIN
  -- Event claim / duplicate / retry / finish guards.
  v := claim_event('evt-one','customer.subscription.updated',100);
  IF v <> 'claimed' THEN RAISE EXCEPTION 'first claim expected claimed, got %',v; END IF;
  v := claim_event('evt-one','customer.subscription.updated',100);
  IF v <> 'busy' THEN RAISE EXCEPTION 'concurrent/in-flight duplicate expected busy, got %',v; END IF;
  PERFORM finish_event('evt-one','processed');
  v := claim_event('evt-one','customer.subscription.updated',100);
  IF v <> 'processed' THEN RAISE EXCEPTION 'processed duplicate expected processed, got %',v; END IF;

  v := claim_event('evt-retry','invoice.payment_failed',101);
  PERFORM finish_event('evt-retry','failed');
  v := claim_event('evt-retry','invoice.payment_failed',101);
  IF v <> 'claimed' THEN RAISE EXCEPTION 'failed event retry expected claimed, got %',v; END IF;
  IF (SELECT attempts FROM webhook_events WHERE stripe_event_id='evt-retry') <> 2
    THEN RAISE EXCEPTION 'retry attempt counter incorrect'; END IF;
  BEGIN
    PERFORM finish_event('evt-never-claimed','processed');
    RAISE EXCEPTION 'unclaimed event unexpectedly finished';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%not claimed%' THEN RAISE; END IF;
  END;

  -- Out-of-order event protection.
  ok := upsert_subscription_guarded('sub-a','user-a','creator',NULL,'active',500);
  IF NOT ok THEN RAISE EXCEPTION 'initial subscription write failed'; END IF;
  ok := upsert_subscription_guarded('sub-a','user-a','creator',NULL,'canceled',400);
  IF ok THEN RAISE EXCEPTION 'older event overwrote newer state'; END IF;
  ok := upsert_subscription_guarded('sub-a','user-a','creator',NULL,'canceled',500);
  IF ok THEN RAISE EXCEPTION 'equal timestamp was accepted without canonical reconciliation'; END IF;
  IF (SELECT status FROM subscriptions WHERE id='sub-a') <> 'active'
    THEN RAISE EXCEPTION 'subscription state was unexpectedly changed'; END IF;
  ok := upsert_subscription_guarded('sub-a','user-a','creator',NULL,'canceled',501);
  IF NOT ok OR (SELECT status FROM subscriptions WHERE id='sub-a') <> 'canceled'
    THEN RAISE EXCEPTION 'newer event did not advance state'; END IF;

  -- Global-only sync ignores site subscriptions even when newer.
  INSERT INTO members(user_id,membership_type,status) VALUES('user-b','Free','Active');
  INSERT INTO subscriptions VALUES
    ('sub-b-global','user-b','crowner',NULL,'active',100,100),
    ('sub-b-site','user-b','founder','crowrules-plus','active',999,999);
  PERFORM sync_global_member('user-b');
  SELECT * INTO m FROM members WHERE user_id='user-b';
  IF m.membership_type <> 'Pro' OR m.status <> 'Active'
    THEN RAISE EXCEPTION 'site subscription contaminated global membership: %, %',m.membership_type,m.status; END IF;

  INSERT INTO members(user_id,membership_type,status) VALUES('user-c','Creator','Active');
  INSERT INTO subscriptions VALUES
    ('sub-c-site','user-c','founder','crowrules-plus','active',999,999);
  PERFORM sync_global_member('user-c');
  SELECT * INTO m FROM members WHERE user_id='user-c';
  IF m.membership_type <> 'Free' OR m.status <> 'Active'
    THEN RAISE EXCEPTION 'site-only subscription incorrectly granted global membership'; END IF;

  INSERT INTO members(user_id,membership_type,status) VALUES('user-d','Free','Active');
  INSERT INTO subscriptions VALUES
    ('sub-d-old','user-d','crowner',NULL,'active',10,10),
    ('sub-d-new','user-d','creator',NULL,'pending',20,20),
    ('sub-d-cancel','user-d','founder','crowrules-plus','cancelled',999,999);
  PERFORM sync_global_member('user-d');
  SELECT * INTO m FROM members WHERE user_id='user-d';
  IF m.membership_type <> 'Creator' OR m.status <> 'Active'
    THEN RAISE EXCEPTION 'global active/pending priority or site isolation failed'; END IF;

  RAISE NOTICE 'PASS: webhook PostgreSQL integration assertions';
END $$;

ROLLBACK;
