# Ohmwork

Free hardware-engineering interview practice: flashcards, circuit diagrams,
study progress, a saved-question queue, and guided LTspice experiments.

**Try the website:** https://ohm-work.vercel.app/

Clone this project, change it locally, or build your own version. Contributions,
bug reports, and new question ideas are welcome.

## Run Your Own Copy

Requirements: Node.js 20.9 or newer, npm, and your own Supabase project.
The public repository does not include access to Ohmwork's production database,
user accounts, private configuration, or deployment history.

```bash
git clone https://github.com/MatthewGerges/ohmwork.git
cd ohmwork
npm ci
cp .env.example .env.local
```

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
   The schema enables row-level security for questions and each user's data.
2. Fill in `.env.local` using **your own** project URL, public anon key, and
   server-only service-role key. Choose a strong `ADMIN_PASSWORD`.
3. In Supabase Authentication, set the local Site URL to `http://localhost:3000`
   and allow `http://localhost:3000/auth/callback`,
   `http://localhost:3000/reset-password`, and `http://localhost:3000/account`.
4. Run `npm run dev` and visit http://localhost:3000. Create a test account in
   your own Supabase project. Email confirmation follows your project's settings.
5. Visit `/admin` and use your admin password to add your first question.

Never use the hosted Ohmwork project's credentials for your own copy. Never put
the service-role key, admin password, SMTP credentials, or OAuth client secret in
`NEXT_PUBLIC_` variables, commits, issues, screenshots, or AI prompts.

### Bundled Questions

Source questions are in `content/questions/`. Many have `uploaded: true` and
production bookkeeping IDs; `npm run questions:upload` skips those by design.
To seed your own empty database, reset `uploaded` to `false` and remove
`supabase_id` in your local copies, then run `npm run questions:upload` with your
own `.env.local`. Do not point an experimental import at the live website.

Some content references externally hosted images or videos. These may require
internet access and are not automatically licensed for redistribution.

### Circuit Diagrams and Simulations

- Editable diagrams: `public/diagrams/`
- LTspice circuits and guides: `spice/` and `spice/README.md`
- Diagram editor: `npm run questions:edit-diagrams -- --help`
- Auth setup details: `docs/authentication.md` (replace production URLs with yours)

The diagram editor is a local development tool. Do not expose it publicly.
Google sign-in, recovery email delivery, and the feedback form require your own
provider configuration; they are not included simply by cloning the code.

## Checks

```bash
npm run lint
npm run build
```

## Contributing

Open an issue or pull request with a focused change. For question corrections,
include the circuit assumptions and reasoning. Test UI changes at desktop and
mobile sizes. Do not submit interview-confidential material or content you do
not have permission to share.

This is a clean source release. The private development repository and its
history are intentionally not included. Changes here do not automatically
deploy to the hosted Ohmwork site.

## License

The original application source code is available under the MIT license in
`LICENSE`. This does **not** grant rights to third-party images, videos, logos,
question content, or other educational/media assets in `content/`, `public/`,
or `spice/`. Those retain their respective rights; get permission or replace
them before redistributing them. Dependencies retain their own licenses.
