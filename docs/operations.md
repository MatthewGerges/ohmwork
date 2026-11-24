# Ohmwork operations

## Supabase free-tier keepalive

Supabase may pause a free project after a period of low activity. Ohmwork performs one real database query each day through a Vercel Cron job:

- Schedule: `17 10 * * *` (10:17 UTC daily)
- Route: `/api/cron/keep-supabase-active`
- Query: a head-only count against `questions`
- Request guard: Vercel's documented `vercel-cron/1.0` user agent

The route rejects ordinary requests and performs only a read-only count using a server-side Supabase client. The user-agent check is not a substitute for a secret, but the endpoint exposes neither query results beyond the public question count nor any write operation or credential. It returns `503` when the database check fails so the failure remains visible in the function logs.

This keeps the existing Supabase and Vercel architecture within their free tiers. It substantially reduces the chance of an inactivity pause, but Supabase only guarantees that a project will not be paused on a paid plan.

## Checks after deployment

1. Confirm the production deployment is `Ready` in Vercel.
2. Confirm `GET /api/cron/keep-supabase-active` returns `401` for an ordinary request.
3. Invoke the route with `User-Agent: vercel-cron/1.0` and confirm it returns `ok: true` with a question count.
4. Check the Vercel Cron page after the first scheduled run if the project has been inactive.
