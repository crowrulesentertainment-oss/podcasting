# CrowRules Podcasting — OAuth provider troubleshooting

## Observed production failure (2026-11-24)

Supabase Auth logs recorded a Microsoft token-exchange failure:

- Provider: Microsoft Entra ID (Azure)
- Error: `AADSTS7000215` — invalid client secret
- Meaning: the value Supabase sent to Microsoft was not accepted as the app's client secret. A common cause is copying the secret ID instead of the secret VALUE, or using an expired/rotated secret.

The browser message `Unable to exchange external code: M.C5` is a shortened/redacted authorization-code prefix. It is not the root cause and should never be treated as a credential or copied into support messages.

## Required dashboard repair

1. Open Microsoft Entra admin center → App registrations → the CrowRules OAuth application.
2. Open **Certificates & secrets** → **Client secrets**.
3. Create a new client secret if the current one is expired, rotated, or unavailable.
4. Copy the **Value** immediately. The Value is only shown once; do not copy the Secret ID.
5. Open Supabase project `cevylpnoexugwgygvtgu` → Authentication → Sign In / Providers → Azure (Microsoft).
6. Confirm the Client ID belongs to the same Entra app and replace the secret with the new **Value**. Save.
7. In Entra, verify the Web redirect URI is exactly:
   `https://cevylpnoexugwgygvtgu.supabase.co/auth/v1/callback`
8. In Supabase Authentication → URL Configuration, allow:
   `https://crowrulesentertainment-oss.github.io/podcasting/auth-callback.html*`
9. Test Microsoft sign-in in a fresh private browser session. Do not share client secrets or authorization codes.

## Application changes

The browser login now tags the return URL with the selected provider, and the callback/login screens provide safe provider-specific guidance for code-exchange failures. The app continues to use the existing Supabase PKCE flow and shared session storage. No database schema, RLS policies, user records, or secret keys are changed by this frontend update.

## Important limitation

A frontend deployment cannot repair a rejected Microsoft client secret. The new secret VALUE must be saved in Supabase's provider configuration by an authorized project administrator.