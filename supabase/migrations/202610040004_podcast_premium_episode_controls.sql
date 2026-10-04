create or replace function public.sync_podcast_episode_premium_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare chosen uuid;
begin
  if lower(coalesce(new.access_level,'free')) = 'premium' then
    if new.monetization_product_id is not null then
      if not exists (
        select 1 from public.cr_podcast_monetization_products p
        where p.id=new.monetization_product_id
          and p.podcast_id=new.podcast_id
          and p.product_type='membership'
          and p.active=true
          and coalesce(p.grants_premium_access,true)=true
      ) then
        raise exception 'Selected premium subscription plan is not active for this podcast';
      end if;
    else
      select p.id into chosen from public.cr_podcast_monetization_products p
      where p.podcast_id=new.podcast_id and p.product_type='membership'
        and p.active=true and coalesce(p.grants_premium_access,true)=true
      order by p.amount_cents asc, p.display_order asc nulls last limit 1;
      if chosen is null then raise exception 'Premium episode requires an active premium subscription plan'; end if;
      new.monetization_product_id:=chosen;
    end if;
    new.monetization_enabled:=true;
  else
    new.monetization_enabled:=false;
    new.monetization_product_id:=null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_podcast_episode_premium_product on public.podcast_episodes;
create trigger trg_sync_podcast_episode_premium_product
before insert or update of podcast_id,access_level,monetization_product_id on public.podcast_episodes
for each row execute function public.sync_podcast_episode_premium_product();
