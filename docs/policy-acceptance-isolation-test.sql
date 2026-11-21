-- LOCAL/CI-ONLY isolation guard test. No fixture rows are created.
-- Must run as a separate transaction because SET TRANSACTION must precede queries.

begin;
set transaction isolation level repeatable read;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','member',true);

do $test$
begin
  begin
    perform public.accept_current_required_policy_versions(array[]::uuid[]);
    raise exception 'Repeatable-read acceptance unexpectedly succeeded';
  exception when sqlstate '25001' then
    if sqlerrm not like 'Policy acceptance requires READ COMMITTED%' then raise; end if;
  end;
end
$test$;

rollback;
