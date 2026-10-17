# CrowRules Podcasting — Social OAuth setup

This document configures the five external social providers for the Publish Everywhere page. Do not put provider secrets in GitHub, browser config files, issue comments, or chat.

## Shared callback URL

Register this exact HTTPS callback URL with each provider product that supports a server-side web OAuth callback:

`https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcast-distribution-api`

TikTok requires a static redirect URI without query parameters; the URL above meets that format. Provider settings must match exactly.

## Supabase Edge Function secrets

In Supabase Dashboard → Project `cevylpnoexugwgygvtgu` → Edge Functions → Secrets, add these keys. Enter the actual values from each provider's developer portal only in the Dashboard.

- `SOCIAL_OAUTH_REDIRECT_URI` = the callback URL above
- `SOCIAL_TOKEN_ENCRYPTION_KEY` = a locally generated 32-byte key represented as 64 hexadecimal characters
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `THREADS_APP_ID`
- `THREADS_APP_SECRET`

Generate the encryption key on your own computer in a private terminal with `openssl rand -hex 32`. Do not paste its output into this repository or into chat. Keep a secure backup: existing encrypted tokens cannot be decrypted if this key is lost or rotated without a planned re-encryption.

The Supabase function's service-role environment key is provided by Supabase; never add it as a custom secret or expose it to the browser.

## Create provider apps

### Meta — Facebook
1. Open https://developers.facebook.com/ and create/select a Meta app.
2. Add Facebook Login and configure the web OAuth redirect URI above.
3. Request Page access scopes required for the intended publishing workflow, including `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.
4. Add the app ID and app secret to the matching Supabase secret names.
5. Use a Page administered by the person authorizing the connection. Publishing is Page-based and requires the correct Page permissions and app access/review.

### Meta — Instagram
1. In Meta for Developers, configure the Instagram API with Instagram Login for the app/product that supports it.
2. Register the same callback URL in the product's OAuth redirect settings.
3. Request `instagram_business_basic` and `instagram_business_content_publish` if available for your app and intended use.
4. Add the Instagram product's client ID and secret as `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.
5. Test with an eligible Instagram professional account. Personal-account eligibility and publishing features depend on the chosen API/product.

### TikTok
1. Open https://developers.tiktok.com/ and create/select a web app.
2. Add Login Kit and register the exact callback URL in the web redirect URI list.
3. Request `user.info.basic` and the required Content Posting API permission, such as `video.publish`, only if it is available for your app.
4. Copy Client Key to `TIKTOK_CLIENT_KEY` and Client Secret to `TIKTOK_CLIENT_SECRET`.
5. Complete TikTok's app review and posting-capability audit if required. Login approval does not guarantee direct-post permission.

### X
1. Open https://developer.x.com/ and create a project/app.
2. Enable OAuth 2.0 Authorization Code with PKCE and configure the callback URL.
3. Set the app type to a confidential web app if the developer portal offers that option and keep its client secret private.
4. Request `users.read`, `tweet.read`, `tweet.write`, and `offline.access` as permitted by your plan and intended use.
5. Save Client ID as `X_CLIENT_ID` and Client Secret as `X_CLIENT_SECRET`. API access level and billing/usage limits may affect publishing.

### Threads
1. Open https://developers.facebook.com/ and configure the Threads API product.
2. Register the callback URL in the Threads OAuth settings.
3. Request `threads_basic` and `threads_content_publish` where supported and approved.
4. Save the Threads-specific app ID and secret as `THREADS_APP_ID` and `THREADS_APP_SECRET`.
5. Complete any required testing, review, and publishing access steps.

## Current backend behavior

- OAuth state is random, single-use, and expires after ten minutes.
- The callback validates and consumes state before exchanging the authorization code.
- Tokens are encrypted using AES-GCM before storage in a table unavailable to anon/authenticated roles.
- The app status is marked connected only after token exchange and profile verification succeed.
- The OAuth callback returns the user to Publish Everywhere with a success/error message.
- Provider authorization is not itself a guarantee of post publishing. Each provider still needs a tested publisher adapter, permission checks, and refresh handling before automated posts should be enabled.

## First test

1. Add the shared redirect and encryption key secrets first.
2. Create one provider app and add its client credentials.
3. Confirm the provider app has the exact callback URL and required permissions.
4. Sign into CrowRules Podcasting, open Publish Everywhere, select your podcast, and choose Connect for that provider.
5. Authorize with a test account and confirm the connection label appears.
6. If it fails, read the safe message on the page and inspect Supabase Edge Function logs. Never share tokens, authorization codes, client secrets, or the encryption key.
