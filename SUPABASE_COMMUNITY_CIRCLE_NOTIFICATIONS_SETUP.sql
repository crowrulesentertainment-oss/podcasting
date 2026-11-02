-- CrowRules Podcasting Community Circle Activity & Notifications
-- Project: cevylpnoexugwgygvtgu
-- Apply after SUPABASE_COMMUNITY_CIRCLES_SETUP.sql.
create table if not exists public.podcast_community_circle_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 invitation_alerts boolean not null default true, discussion_alerts boolean not null default true,
 reply_alerts boolean not null default true, moderation_alerts boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.podcast_community_circle_notification_preferences enable row level security;
drop policy if exists "Members read own circle notification preferences" on public.podcast_community_circle_notification_preferences;
create policy "Members read own circle notification preferences" on public.podcast_community_circle_notification_preferences for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Members create own circle notification preferences" on public.podcast_community_circle_notification_preferences;
create policy "Members create own circle notification preferences" on public.podcast_community_circle_notification_preferences for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Members update own circle notification preferences" on public.podcast_community_circle_notification_preferences;
create policy "Members update own circle notification preferences" on public.podcast_community_circle_notification_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.podcast_community_circle_notification_preferences from public,anon;
grant select,insert,update on public.podcast_community_circle_notification_preferences to authenticated;

create or replace function private.notify_podcast_circle_invitation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare enabled boolean:=true; circle_label text; inviter_label text;
begin
 if new.status<>'pending' then return new; end if;
 select coalesce(p.invitation_alerts,true) into enabled from public.podcast_community_circle_notification_preferences p where p.user_id=new.invitee_id;
 if not found then enabled:=true; end if;
 if not enabled then return new; end if;
 select c.name into circle_label from public.podcast_community_circles c where c.id=new.circle_id;
 select coalesce(nullif(mp.display_name,''),nullif(mp.username,''),'A circle owner') into inviter_label from public.podcast_member_profiles mp where mp.user_id=new.inviter_id;
 insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
 values(new.invitee_id,new.inviter_id,'circle_invitation','Community circle invitation',coalesce(inviter_label,'A circle owner')||' invited you to '||coalesce(circle_label,'a Community Circle')||'.','Podcasting','/podcasting/listener/circle-management.html?invite='||new.id::text,jsonb_build_object('circle_id',new.circle_id,'invitation_id',new.id),75,'podcast-circle-invite:'||new.id::text) on conflict do nothing;
 return new;
end; $$;
revoke all on function private.notify_podcast_circle_invitation() from public,anon,authenticated;
drop trigger if exists podcast_circle_invitation_notify on public.podcast_community_circle_invites;
create trigger podcast_circle_invitation_notify after insert on public.podcast_community_circle_invites for each row execute function private.notify_podcast_circle_invitation();

create or replace function private.notify_podcast_circle_post()
returns trigger language plpgsql security definer set search_path=''
as $$
declare member record; enabled boolean; circle_label text; author_label text;
begin
 select c.name into circle_label from public.podcast_community_circles c where c.id=new.circle_id;
 select coalesce(nullif(mp.display_name,''),nullif(mp.username,''),'A circle member') into author_label from public.podcast_member_profiles mp where mp.user_id=new.author_id;
 for member in select m.member_id from public.podcast_community_circle_members m where m.circle_id=new.circle_id and m.member_id<>new.author_id loop
  enabled:=true;
  select coalesce(p.discussion_alerts,true) into enabled from public.podcast_community_circle_notification_preferences p where p.user_id=member.member_id;
  if not found then enabled:=true; end if;
  if enabled then
   insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
   values(member.member_id,new.author_id,'circle_new_discussion','New circle discussion',coalesce(author_label,'A circle member')||' started a discussion in '||coalesce(circle_label,'your circle')||'.','Podcasting','/podcasting/listener/circles.html?circle='||new.circle_id::text||'&post='||new.id::text,jsonb_build_object('circle_id',new.circle_id,'post_id',new.id),50,'podcast-circle-post:'||new.id::text||':'||member.member_id::text) on conflict do nothing;
  end if;
 end loop;
 return new;
end; $$;
revoke all on function private.notify_podcast_circle_post() from public,anon,authenticated;
drop trigger if exists podcast_circle_post_notify on public.podcast_community_circle_posts;
create trigger podcast_circle_post_notify after insert on public.podcast_community_circle_posts for each row execute function private.notify_podcast_circle_post();

create or replace function private.notify_podcast_circle_reply()
returns trigger language plpgsql security definer set search_path=''
as $$
declare post_author uuid; post_circle uuid; circle_label text; enabled boolean:=true; replier_label text;
begin
 select p.author_id,p.circle_id,c.name into post_author,post_circle,circle_label from public.podcast_community_circle_posts p join public.podcast_community_circles c on c.id=p.circle_id where p.id=new.post_id;
 if post_author is null or post_author=new.author_id then return new; end if;
 select coalesce(p.reply_alerts,true) into enabled from public.podcast_community_circle_notification_preferences p where p.user_id=post_author;
 if not found then enabled:=true; end if;
 if not enabled then return new; end if;
 select coalesce(nullif(mp.display_name,''),nullif(mp.username,''),'A circle member') into replier_label from public.podcast_member_profiles mp where mp.user_id=new.author_id;
 insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
 values(post_author,new.author_id,'circle_discussion_reply','New reply to your discussion',coalesce(replier_label,'A circle member')||' replied in '||coalesce(circle_label,'your circle')||'.','Podcasting','/podcasting/listener/circles.html?circle='||post_circle::text||'&post='||new.post_id::text,jsonb_build_object('circle_id',post_circle,'post_id',new.post_id,'reply_id',new.id),60,'podcast-circle-reply:'||new.id::text) on conflict do nothing;
 return new;
end; $$;
revoke all on function private.notify_podcast_circle_reply() from public,anon,authenticated;
drop trigger if exists podcast_circle_reply_notify on public.podcast_community_circle_replies;
create trigger podcast_circle_reply_notify after insert on public.podcast_community_circle_replies for each row execute function private.notify_podcast_circle_reply();

create or replace function private.notify_podcast_circle_moderation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare circle uuid; owner_id uuid; target_id uuid; enabled boolean:=true; member_label text; headline text; detail text; circle_label text; role_label text;
begin
 if tg_op='UPDATE' then
  if old.role is not distinct from new.role or new.role<>'moderator' then return new; end if;
  circle:=new.circle_id; target_id:=new.member_id; role_label:=new.role; headline:='New circle moderator'; detail:=' was promoted to moderator.';
 else
  circle:=old.circle_id; target_id:=old.member_id; role_label:=old.role; headline:='Circle member removed'; detail:=' was removed from your circle.';
 end if;
 select c.owner_id,c.name into owner_id,circle_label from public.podcast_community_circles c where c.id=circle;
 if owner_id is null or owner_id=target_id or owner_id=auth.uid() then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 select coalesce(p.moderation_alerts,true) into enabled from public.podcast_community_circle_notification_preferences p where p.user_id=owner_id;
 if not found then enabled:=true; end if;
 if enabled then
  select coalesce(nullif(mp.display_name,''),nullif(mp.username,''),'A member') into member_label from public.podcast_member_profiles mp where mp.user_id=target_id;
  insert into public.crowrules_notifications(user_id,actor_user_id,type,title,body,division,action_url,metadata,priority,dedupe_key)
  values(owner_id,auth.uid(),'circle_moderation',headline,coalesce(member_label,'A member')||detail||' ('||coalesce(circle_label,'Community Circle')||').','Podcasting','/podcasting/listener/circle-management.html?circle='||circle::text,jsonb_build_object('circle_id',circle,'member_id',target_id,'event',tg_op),65,'podcast-circle-moderation:'||circle::text||':'||target_id::text||':'||tg_op||':'||role_label) on conflict do nothing;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.notify_podcast_circle_moderation() from public,anon,authenticated;
drop trigger if exists podcast_circle_moderator_notify on public.podcast_community_circle_members;
create trigger podcast_circle_moderator_notify after update of role on public.podcast_community_circle_members for each row execute function private.notify_podcast_circle_moderation();
drop trigger if exists podcast_circle_member_removed_notify on public.podcast_community_circle_members;
create trigger podcast_circle_member_removed_notify after delete on public.podcast_community_circle_members for each row execute function private.notify_podcast_circle_moderation();
