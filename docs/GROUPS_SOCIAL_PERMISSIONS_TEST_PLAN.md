# Groups social permissions — test plan

**Status:** Proposed; not executed.  
**Target:** Local Supabase database only, after migration-history recovery and full local replay.  
**Production:** No changes.

## Schema facts confirmed by read-only inspection

- Replies have `id, post_id, circle_id, author_id, body, created_at`.
- Reply body length is constrained to 1–1500 characters.
- Helpful votes have a composite primary key on `(reply_id, voter_id)`; existing policies already require a same-circle member voting on another member's reply.
- Circle events and RSVPs already exist; events are created by circle owners/moderators and RSVP rows are member-scoped.
- The database has no pgTAP or Supabase test-helper extension installed at inspection time.

## Pre-migration data integrity check

Run and inspect before applying the proposed RLS correction:

```sql
select r.id, r.circle_id, p.circle_id as post_circle_id
from public.podcast_community_circle_replies r
left join public.podcast_community_circle_posts p on p.id = r.post_id
where p.id is null or p.circle_id <> r.circle_id;
```

Expected: zero rows. Resolve any mismatch before proceeding.

## Required two-circle / multi-identity test matrix

Create two disposable circles (A and B), each with an owner, moderator, and regular member. Also create one non-member identity and one anonymous session. Use distinct test users; do not use real member accounts.

| Test | Expected |
|---|---|
| Anonymous reads a post and its replies in public circle A | Allowed |
| Anonymous reads private/hidden circle content | Denied by parent-post RLS |
| Member A reads roster A | Allowed |
| Member A reads roster B | Denied |
| Non-member reads roster A | Denied |
| Member A inserts reply on post A with circle_id A | Allowed |
| Member A inserts reply on post B while claiming circle_id A | Denied |
| Member A inserts reply on post A while claiming circle_id B | Denied |
| Member B inserts reply in circle A | Denied |
| Member A inserts reply with another author's author_id | Denied |
| Member A votes helpful on another member's reply in A | Allowed |
| Member A votes on a reply in B or their own reply | Denied |
| Owner/moderator changes membership role within allowed role set | Allowed |
| Regular member attempts to promote self or another member | Denied |
| Regular member leaves their own group | Allowed, except owner protection |
| Moderator removes a regular member, not the owner | Allowed |

## Release gates

1. Reconcile migration history and replay the full project locally.
2. Run the integrity query; require zero mismatches.
3. Review the SQL diff and helper function grants.
4. Apply the patch locally only.
5. Run the matrix using real authenticated JWT claims for disposable test users and verify both positive and negative cases.
6. Confirm unrelated tables, policies, and existing members are unchanged.
7. Only after approval, generate the official CLI migration and schedule production application.

Do not enable the Groups replies or member directory UI against production until these gates pass.
