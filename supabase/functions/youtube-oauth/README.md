# YouTube OAuth connection for CrowRules Podcasting

This Edge Function implements the **account-authorization** step for YouTube. It uses Google OAuth authorization-code flow with PKCE, validates the signed-in creator's podcast ownership before starting, consumes one-time OAuth state, verifies the authorized YouTube channel, and encrypts provider tokens with AES-GCM before storing ciphertext in the private token vault.

## Required Supabase Edge Function secrets

Set these under Supabase Dashboard → Edge Functions → Secrets for project `cevylpnoexugwgygvtgu`:

- `GOOGLE_YOUTUBE_CLIENT_ID` — OAuth client ID from Google Cloud.
- `GOOGLE_YOUTUBE_CLIENT_SECRET` — OAuth client secret. Never put this in GitHub source or browser code.
- `DISTRIBUTION_TOKEN_ENCRYPTION_KEY` — 64 hexadecimal characters representing 32 random bytes. Generate locally with Python:
  ```python
  import secrets
  print(secrets.token_hex(32))
  ```
  Save the output directly into Supabase Secrets; do not paste it into chat or commit it.
- `DISTRIBUTION_APP_URL` — optional. Defaults to `https://crowrulesentertainment-oss.github.io/podcasting/creator/distribution.html`.

Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are also required by the function runtime. The service-role key is used only server-side and must never be placed in the public site.

## Google Cloud setup

1. In Google Cloud Console, create/select a project and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen. Add CrowRules as the app name and provide the required support/contact information. During testing, add your Google account as a test user if Google requires it.
3. Create an OAuth client ID of type **Web application**.
4. Add this exact **Authorized redirect URI**:
   `https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/youtube-oauth`
5. Save the OAuth client ID and secret into the Supabase Edge Function secrets above.

Requested scopes: `openid`, `email`, `youtube.readonly`, and `youtube.upload`. Google may require consent-screen verification before the app can be used by people beyond configured test users.

## What is implemented

- Per-creator, per-podcast YouTube connection start.
- PKCE verifier and hashed one-time OAuth state stored in the private schema; state expires after ten minutes and is consumed once.
- Server-side authorization-code exchange and channel identity lookup.
- AES-GCM encryption of access and refresh tokens before the private token vault receives them.
- Account status changes to `connected` only after Google returns a valid YouTube channel and the encrypted tokens are stored.
- Distribution page displays connection status and channel link.
- Authenticated `refresh` action checks podcast ownership, decrypts the refresh token only inside the Edge Function, exchanges it with Google, encrypts and saves the new access token, then verifies the channel with YouTube Data API.
- If Google returns `invalid_grant`, the account status is set to `expired` and the creator is told to reconnect.
- The distribution page's **Test token refresh** control performs a token-refresh and channel-verification check only; it does not upload or publish anything.
- Refresh-token lookup and updates use service-role-only RPCs. Raw tokens are never returned to the browser.

## Current limitations

- This connection does **not** enable automatic video upload or post publishing by itself. The YouTube publishing adapter, revocation/disconnect controls, and end-to-end upload tests remain separate work.
- If Google does not issue a refresh token, the account may need to reconnect when the access token expires.
- Do not change the encryption key after tokens have been stored unless a migration/re-encryption plan is in place; existing ciphertext would no longer be decryptable.
- OAuth secrets are deliberately not stored in the repository.
