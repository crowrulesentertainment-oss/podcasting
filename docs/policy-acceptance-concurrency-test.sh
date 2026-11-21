#!/usr/bin/env bash
# Disposable-only two-session concurrency tests for policy acceptance/lifecycle.
# Requires synthetic auth.users rows for POLICY_TEST_MEMBER_A/B.
set -euo pipefail

MEMBER_A="${POLICY_TEST_MEMBER_A:-10000000-0000-0000-0000-000000000001}"
MEMBER_B="${POLICY_TEST_MEMBER_B:-20000000-0000-0000-0000-000000000002}"
if [[ -n "${DB_URL:-}" ]]; then
  PSQL=(psql "$DB_URL" -X -v ON_ERROR_STOP=1)
else
  PSQL=(psql -X -v ON_ERROR_STOP=1)
fi

suffix="$(date +%s%N)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

new_published_fixture() {
  local key="$1"
  local row
  row="$("${PSQL[@]}" -qAt -F '|' <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_B',true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_create_document('$key','$key','Disposable concurrency fixture') as doc_id \gset
select public.policy_admin_create_draft_version(
  :'doc_id','v1','https://example.invalid/$key-v1',repeat('a',64),
  true,transaction_timestamp()-interval '1 minute',null
) as version_id \gset
select public.policy_admin_publish_version(:'version_id'::uuid);
commit;
select :'doc_id', :'version_id';
SQL
)"
  printf '%s\n' "$row" | tail -n 1
}

new_draft_fixture() {
  local doc_id="$1"
  local row
  row="$("${PSQL[@]}" -qAt <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_B',true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_create_draft_version(
  '$doc_id','v2','https://example.invalid/concurrency-v2',repeat('b',64),
  true,transaction_timestamp()-interval '30 seconds',null
) as version_id \gset
commit;
select :'version_id';
SQL
)"
  printf '%s\n' "$row" | tail -n 1
}

publish_optional_replacement() {
  local doc_id="$1"
  local label="$2"
  "${PSQL[@]}" -qAt <<SQL >/dev/null
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_B',true);
select set_config('request.jwt.claim.role','admin',true);
select public.policy_admin_create_draft_version(
  '$doc_id','$label','https://example.invalid/$label',repeat('c',64),
  false,transaction_timestamp()-interval '30 seconds',null
) as version_id \gset
select public.policy_admin_publish_version(:'version_id'::uuid);
commit;
SQL
}

run_multi_acceptance() {
  local member="$1"
  local first="$2"
  local second="$3"
  local delay="$4"
  "${PSQL[@]}" <<SQL
begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','$member',true);
select set_config('request.jwt.claim.role','member',true);
select public.accept_current_required_policy_versions(
  array['$first'::uuid,'$second'::uuid]
);
select pg_sleep($delay);
commit;
SQL
}

assert_sql() {
  local sql="$1"
  "${PSQL[@]}" -qAt -c "$sql" | grep -qx 't'
}

run_member_acceptance() {
  local member="$1"
  local version="$2"
  local delay="$3"
  "${PSQL[@]}" <<SQL
begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','$member',true);
select set_config('request.jwt.claim.role','member',true);
select public.accept_current_required_policy_versions(array['$version'::uuid]);
select pg_sleep($delay);
commit;
SQL
}

run_admin_action() {
  local action="$1"
  local version="$2"
  local delay="$3"
  "${PSQL[@]}" <<SQL
begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_B',true);
select set_config('request.jwt.claim.role','admin',true);
select public.$action('$version'::uuid);
select pg_sleep($delay);
commit;
SQL
}

expect_acceptance_rejection() {
  local version="$1"
  local log="$2"
  if "${PSQL[@]}" -v VERBOSITY=verbose <<SQL >"$log" 2>&1
begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_A',true);
select set_config('request.jwt.claim.role','member',true);
select public.accept_current_required_policy_versions(array['$version'::uuid]);
commit;
SQL
  then
    echo "Expected stale acceptance to be rejected, but it succeeded."
    exit 1
  fi
  if ! grep -q '22023' "$log"; then
    cat "$log"
    echo "Expected SQLSTATE 22023 from stale acceptance."
    exit 1
  fi
}

# 1. Acceptance obtains the document lock first. Withdrawal waits; the
#    acceptance remains valid for the version current when it acquired the lock.
IFS='|' read -r doc_a version_a <<<"$(new_published_fixture "concurrency_accept_first_$suffix")"
run_member_acceptance "$MEMBER_A" "$version_a" 2 >"$tmpdir/accept-first-member.log" 2>&1 &
accept_pid=$!
sleep 0.4
run_admin_action policy_admin_withdraw_version "$version_a" 0 >"$tmpdir/accept-first-admin.log" 2>&1 &
withdraw_pid=$!
wait "$accept_pid" || { cat "$tmpdir/accept-first-member.log"; exit 1; }
wait "$withdraw_pid" || { cat "$tmpdir/accept-first-admin.log"; exit 1; }
assert_sql "select count(*)=1 from public.policy_acceptances where user_id='$MEMBER_A'::uuid and policy_version_id='$version_a'::uuid"
assert_sql "select status='withdrawn' from public.policy_versions where id='$version_a'::uuid"
publish_optional_replacement "$doc_a" optional-after-withdrawal

# 2. Withdrawal obtains the lock first. Acceptance waits, then sees the
#    withdrawn latest version and fails rather than accepting the older row.
IFS='|' read -r doc_b version_b <<<"$(new_published_fixture "concurrency_withdraw_first_$suffix")"
run_admin_action policy_admin_withdraw_version "$version_b" 2 >"$tmpdir/withdraw-first-admin.log" 2>&1 &
withdraw_first_pid=$!
sleep 0.4
expect_acceptance_rejection "$version_b" "$tmpdir/withdraw-first-member.log" &
reject_pid=$!
wait "$withdraw_first_pid" || { cat "$tmpdir/withdraw-first-admin.log"; exit 1; }
if wait "$reject_pid"; then
  :
else
  echo "The expected withdrawal-first rejection harness failed."
  cat "$tmpdir/withdraw-first-member.log"
  exit 1
fi
assert_sql "select count(*)=0 from public.policy_acceptances where user_id='$MEMBER_A'::uuid and policy_version_id='$version_b'::uuid"
publish_optional_replacement "$doc_b" optional-after-withdrawal

# 3. Publication obtains the lock first. Acceptance waits and cannot accept the
#    formerly-current version after the new effective version is published.
IFS='|' read -r doc_c old_c <<<"$(new_published_fixture "concurrency_publish_first_$suffix")"
new_c="$(new_draft_fixture "$doc_c")"
run_admin_action policy_admin_publish_version "$new_c" 2 >"$tmpdir/publish-first-admin.log" 2>&1 &
publish_pid=$!
sleep 0.4
expect_acceptance_rejection "$old_c" "$tmpdir/publish-first-member.log" &
publish_reject_pid=$!
wait "$publish_pid" || { cat "$tmpdir/publish-first-admin.log"; exit 1; }
if wait "$publish_reject_pid"; then
  :
else
  echo "The expected publication-first rejection harness failed."
  cat "$tmpdir/publish-first-member.log"
  exit 1
fi
assert_sql "select count(*)=0 from public.policy_acceptances where user_id='$MEMBER_A'::uuid and policy_version_id='$old_c'::uuid"
publish_optional_replacement "$doc_c" optional-after-publish

# 4. Two acceptance sessions submit the same two-document set in opposite
#    input orders. Both must complete without deadlock or partial acceptance.
IFS='|' read -r doc_d version_d1 <<<"$(new_published_fixture "concurrency_multi_a_$suffix")"
IFS='|' read -r doc_e version_e1 <<<"$(new_published_fixture "concurrency_multi_b_$suffix")"
run_multi_acceptance "$MEMBER_A" "$version_d1" "$version_e1" 1 >"$tmpdir/multi-a.log" 2>&1 &
multi_a_pid=$!
sleep 0.2
"${PSQL[@]}" <<SQL >"$tmpdir/multi-b.log" 2>&1 &
begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','$MEMBER_B',true);
select set_config('request.jwt.claim.role','member',true);
select public.accept_current_required_policy_versions(array['$version_e1'::uuid,'$version_d1'::uuid]);
commit;
SQL
multi_b_pid=$!
wait "$multi_a_pid" || { cat "$tmpdir/multi-a.log"; exit 1; }
wait "$multi_b_pid" || { cat "$tmpdir/multi-b.log"; exit 1; }
assert_sql "select count(*)=2 from public.policy_acceptances where user_id='$MEMBER_A'::uuid and policy_version_id in ('$version_d1'::uuid,'$version_e1'::uuid)"
assert_sql "select count(*)=2 from public.policy_acceptances where user_id='$MEMBER_B'::uuid and policy_version_id in ('$version_d1'::uuid,'$version_e1'::uuid)"

echo "All policy acceptance concurrency scenarios passed."
