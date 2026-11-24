# Security

Do not report credentials or user data in a public issue. Report vulnerabilities
privately through this repository's Security tab when private reporting is
available. If you discover an exposed credential, notify its owner privately
and rotate it before treating deletion from source as a fix.

Local `.env*` files are ignored except the placeholder-only `.env.example`.
Public Supabase anon/publishable keys are not privileged server credentials;
row-level security must still be enabled. Service-role/secret keys must remain
server-only. Use your own backend and credentials when cloning this project.
