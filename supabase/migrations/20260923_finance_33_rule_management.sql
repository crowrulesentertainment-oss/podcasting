create or replace function public.update_my_podcast_finance_alert_rule(p_rule_id uuid,p_rule_name text,p_threshold_cents bigint,p_enabled boolean,p_repeatable boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 if char_length(trim(p_rule_name)) not between 1 and 100 then raise exception 'Invalid rule name'; end if;
 if p_threshold_cents is null or p_threshold_cents<=0 then raise exception 'Threshold must be positive'; end if;
 update public.cr_podcast_finance_alert_rules set rule_name=trim(p_rule_name),threshold_cents=p_threshold_cents,enabled=p_enabled,repeatable=p_repeatable,updated_at=now()
 where id=p_rule_id and creator_id=v_creator;
 if not found then raise exception 'Rule not found'; end if; return true;
end $$;
revoke all on function public.update_my_podcast_finance_alert_rule(uuid,text,bigint,boolean,boolean) from public;
grant execute on function public.update_my_podcast_finance_alert_rule(uuid,text,bigint,boolean,boolean) to authenticated;
create or replace function public.delete_my_podcast_finance_alert_rule(p_rule_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 delete from public.cr_podcast_finance_alert_rules where id=p_rule_id and creator_id=v_creator;
 if not found then raise exception 'Rule not found'; end if; return true;
end $$;
revoke all on function public.delete_my_podcast_finance_alert_rule(uuid) from public;
grant execute on function public.delete_my_podcast_finance_alert_rule(uuid) to authenticated;