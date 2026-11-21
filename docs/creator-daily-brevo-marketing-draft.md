# Creator Daily — Brevo marketing campaign draft test

This branch adds an isolated, administrator-only Edge Function:
`podcast-creator-daily-marketing-draft`.

## Scope

- Uses Brevo's Marketing Email Campaign API (`POST /v3/emailCampaigns`), not transactional SMTP.
- Creates a fixed synthetic campaign draft.
- Omits recipients, list IDs, and scheduling fields.
- Reads the campaign back and verifies `status=draft`, no recipient lists, and no scheduled time.
- Does not read creator profiles, consent records, briefings, statistics, or episode data.
- Does not write to Supabase campaign or delivery tables.
- Contains no send, schedule, or sendNow operation.
- Leaves Brevo's default campaign footer/unsubscribe page in place.

## Required Edge Function secrets

Existing project secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY`

No new secret is introduced.

## Invocation

POST to the deployed function with a signed-in administrator JWT:

```json
{
  "action": "create_test_draft",
  "confirm": true
}
```

The function is not deployed by this branch. Review and merge are required before deployment.

## Important limits

A recipient-free draft verifies campaign API authentication, creation, retrieval, and draft state only. It does **not** prove that Brevo renders the unsubscribe footer or emits RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers on a delivered message. Those require a separately approved, controlled test send to a dedicated test contact/list, followed by inspection of the received raw message headers and the unsubscribe webhook. Production creator data and production delivery remain out of scope.

## Personalization architecture still required

Brevo marketing campaigns target contact lists/segments, not arbitrary per-recipient message payloads. Creator Daily content is personalized and contains private creator data. Before a real creator campaign path is designed, it must guarantee one-recipient isolation (or a demonstrably equivalent per-contact template strategy), consent suppression, and a dedicated test audience. Do not put multiple creators' private digests into one shared campaign.
