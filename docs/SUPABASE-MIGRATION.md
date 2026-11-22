# Supabase migration status — BUILDWITHELI MEDIA

## Selected project

BUILDWITHELI MEDIA is using the existing Supabase project **Nova** temporarily as its primary Supabase project:

- Project ref: `xtchvetdluriblzyknhp`
- Region: `eu-west-1`
- Project URL: `https://xtchvetdluriblzyknhp.supabase.co`

The separate BUILDWITHELI MEDIA Supabase organization was not accessible through the connected account at the time this migration started. This choice follows the owner's instruction to use the currently available project.

## Isolation and preservation

Nova already hosts data for other applications. Do not rename, drop, truncate, or repurpose existing Nova tables or buckets.

BUILDWITHELI MEDIA has its own namespaced tables:

- `bwm_profiles`
- `bwm_posts`
- `bwm_subscriptions`
- `bwm_transactions`
- `bwm_app_settings`
- `bwm_moderation_history`
- `bwm_admin_audit`
- `bwm_announcements`

All eight tables have Row Level Security enabled. Direct `anon` and `authenticated` table privileges are revoked; the planned Node API accesses them using the server-only Supabase service-role key. Never place that key in Vite variables or browser code.

A dedicated public-read bucket, `bwm-creator-media`, has been created with an 8 MiB limit and JPG, PNG, and WebP allowlist. Uploads must be performed by the trusted API using the service-role key. The existing `social-media-published` bucket remains untouched.

## Current implementation status

The database schema and media bucket have been provisioned and verified in Nova. The application code still contains Firebase Authentication and Firestore Admin integration at this point. **The runtime migration is not complete yet**: do not remove Firebase dependencies or switch production traffic until the Supabase Auth and Postgres API implementation, tests, and deployment environment variables are ready.

## Planned cutover sequence

1. Replace Firebase browser authentication with Supabase Auth (email/password, verification, password reset, session restore).
2. Replace Firebase Admin token verification with server-side Supabase user verification; check suspended profiles and enforce owner access using a verified Supabase user UUID configured only on the server.
3. Move creator profiles, posts, subscriptions, transactions, settings, moderation history, audit events, and announcements to the `bwm_*` tables.
4. Change creator image uploads to `bwm-creator-media`, preserving the 8 MiB and MIME-type restrictions.
5. Remove Firebase packages, configuration, rules, and deployment references only after the new implementation passes tests.
6. Set production secrets in the Node host, run end-to-end tests using Paystack TEST mode, and verify registration, moderation, payment webhook verification, subscription expiry checks, and admin authorization before cutover.

## Required server configuration at cutover

- `SUPABASE_URL=https://xtchvetdluriblzyknhp.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` (or the project's publishable key; safe for client identification, but server should still verify user JWTs)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret; never share in chat or commit)
- `OWNER_SUPABASE_UID` (the owner's immutable UUID after creating and verifying the owner account in Supabase Auth)
- Existing Paystack TEST credentials and canonical `APP_ORIGIN`

The project's publishable key can be retrieved from Supabase Project Settings → API Keys. Keep the service-role key only in the local server environment or hosting provider's secret manager.

## Backup note

Nova is currently the selected primary project, not an independent backup. A second Supabase project or external backup destination is required for disaster recovery. No cross-project replication is enabled, and no backup data is being written to another project.
