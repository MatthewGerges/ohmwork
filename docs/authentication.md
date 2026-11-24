# Ohmwork authentication

## Password recovery

The sign-in form includes **Forgot password?**. It requests a Supabase recovery email without revealing whether an address is registered. The recovery page updates the password through the browser's authenticated Supabase session.

Production Site URL: `https://ohm-work.vercel.app`

Add these exact production redirect URLs in Supabase Authentication > URL Configuration:

- `https://ohm-work.vercel.app/reset-password`
- `https://ohm-work.vercel.app/auth/callback`
- `https://ohm-work.vercel.app/account`

The shared recovery listener also handles PASSWORD_RECOVERY on the Site URL if Supabase falls back to that URL. Local development URLs must be allowlisted separately. Do not allow arbitrary production domains or untrusted preview domains.

Supabase email rate limits and sender configuration still apply. Browser tests mock email delivery and password updates; they do not prove real inbox delivery.

## Google OAuth

The Google button checks provider availability before redirecting. It displays a clear fallback to email sign-in while the provider is disabled.

In Google Cloud, configure an external OAuth app named Ohmwork and a Web application OAuth client. Request only the standard identity scopes (openid, email, profile). Use this authorized redirect URI:

`https://fqlbyuxrwranszoepnyd.supabase.co/auth/v1/callback`

Authorized JavaScript origin: `https://ohm-work.vercel.app`.

Enter the client ID and client secret directly in Supabase Authentication > Sign In / Providers > Google, then enable it. Do not place the client secret in browser code, repository files, or chat. An external Google app left in Testing mode may limit access to configured test users; set the audience appropriately before a general launch.

The app callback supports implicit sessions and PKCE code exchange. After successful verification it returns to the flashcards. This does not bypass Supabase authentication or row-level security.

## Verification

- Request a recovery email for an account you control, follow the link, update the password, and verify login with it.
- Sign in with Google using an account you control, and verify that study progress remains private to that account.
- Check signup confirmation and expired-link errors on mobile.

Provider activation and redirect settings require access to the Google Cloud and Supabase dashboards. The database-only MCP connection cannot change provider settings.
