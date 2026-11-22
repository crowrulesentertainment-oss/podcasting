-- CrowRules Podcasting: require explicit public-display permission for public challenge ballots.
-- Preserve the existing one-ballot-per-member unique index and all creator ownership rules.
drop policy if exists "members cast one valid challenge vote" on public.podcast_challenge_votes;

create policy "members cast one valid challenge vote"
on public.podcast_challenge_votes
for insert
to authenticated
with check (
  voter_user_id = (select auth.uid())
  and exists (
    select 1
    from public.podcast_challenge_submissions s
    join public.podcast_monthly_challenges c on c.id = s.challenge_id
    where s.id = podcast_challenge_votes.submission_id
      and s.challenge_id = podcast_challenge_votes.challenge_id
      and s.status = 'approved'
      and s.public_display_consent is true
      and s.published_at is not null
      and s.archived_at is null
      and s.creator_user_id <> (select auth.uid())
      and c.status in ('published', 'voting')
      and now() >= c.voting_opens_at
      and now() <= c.voting_closes_at
  )
);

comment on policy "members cast one valid challenge vote" on public.podcast_challenge_votes
is 'One ballot per authenticated account per challenge; only during the voting window for an approved, explicitly public, published, non-archived entry; self-voting is prohibited.';
