# Supabase Auth email templates — CrowRules Podcasting

The Podcasting frontend uses the Supabase JavaScript client with PKCE (`flowType: "pkce"`). For confirmation and recovery emails, use token-hash links that return to the static-site callback page. The callback exchanges the hash with `sb.auth.verifyOtp()`.

This avoids sending a PKCE-prefixed token through the Auth GET `/verify` route, which is currently returning HTTP 500 for the project's email verification requests.

## Confirm signup

In Supabase Dashboard → Authentication → Email Templates → Confirm signup, use:

```html
<h2>Confirm your CrowRules Podcasting account</h2>
<p>Thanks for joining CrowRules Podcasting. Confirm your email address to activate your account.</p>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirm my email address</a></p>
<p>If you did not create this account, you can ignore this email.</p>
```

The app sends `emailRedirectTo` as:

`https://crowrulesentertainment-oss.github.io/podcasting/auth-callback.html?source=podcasting`

The callback calls `sb.auth.verifyOtp({ token_hash, type: "email" })`.

## Reset password

In Authentication → Email Templates → Reset password, use:

```html
<h2>Reset your CrowRules Podcasting password</h2>
<p>We received a request to reset your password. Use the link below to choose a new password.</p>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

The app sends the recovery redirect as:

`https://crowrulesentertainment-oss.github.io/podcasting/auth-callback.html?flow=recovery`

The callback exchanges the recovery token, then presents the password update form.

## Redirect allow-list

Ensure Supabase Auth URL configuration allows:

`https://crowrulesentertainment-oss.github.io/podcasting/auth-callback.html`

Keep the existing login/signup URLs allowed as well.

Do not put a service-role key or Supabase access token in the repository. Do not disable email verification, JWT checks, or RLS to work around verification errors.

## Why this change is needed

The project logs show GET `/verify` returning HTTP 500 with `unsupported authentication method "email"`. Supabase documents token-hash email verification through `verifyOtp`; this project is using PKCE and the current GET verification route is failing. The token-hash link sends the hash to the callback, which exchanges it through the documented email OTP verification method. This does not modify user records, tables, or RLS.