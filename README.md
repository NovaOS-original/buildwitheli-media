# BUILDWITHELI MEDIA

BUILDWITHELI MEDIA is a creator-led publishing platform for approved articles and externally hosted vlog links.

## Current architecture

- **Frontend:** React + Vite, deployed as a static site on GitHub Pages.
- **Authentication:** Supabase Auth (email/password, email verification, password reset).
- **Database:** Supabase Postgres with Row Level Security (RLS).
- **Media:** Supabase Storage bucket `bwm-creator-media` (JPG, PNG and WebP; 8 MiB maximum).
- **Deployment:** GitHub Actions builds the static site for GitHub Pages.
- **Payments:** Disabled for the current free early-access launch.
- **Email:** Existing Supabase custom Gmail SMTP remains responsible for authentication emails. The Resend integration is postponed until a verified sending domain is available.

The current site does not require a Firebase runtime, Firestore, an Express server, Render hosting or Paystack for its active publishing workflow. Older Firebase/Render instructions have been retired; see the current deployment guide in `docs/PRODUCTION-DEPLOYMENT.md`.

## Main features

- Public discovery of approved stories and categories.
- Creator registration, email verification and Super Admin approval.
- Creator profile editing and story/vlog submissions.
- Editorial moderation before public publication.
- Super Admin controls for creator approvals, suspension, content moderation, featured stories, categories, announcements, support requests and audit history.
- Terms & Conditions and Privacy Policy pages.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev` to start Vite.
4. Run `npm test` and `npm run build` before publishing changes.

The Supabase URL and publishable key are configured in `src/supabase.js` with optional Vite environment overrides. A Supabase publishable key is designed for browser use; it is not a secret. **Never place a Supabase service-role key, Resend API key, SMTP password or other server secret in frontend code or a `VITE_*` variable.**

## Database and access-control notes

- BWM tables are namespaced with `bwm_` to avoid collisions with other Nova applications.
- RLS is enabled on the BWM tables.
- Public visitors can read published stories and approved creator display names only.
- Creator profile email addresses are not selectable through the public or authenticated table API. Super Admin user listings use a guarded database function.
- Creator media writes are restricted to the authenticated, verified, approved creator's own UID folder.
- The media bucket is public so published story images can load without sign-in. Do not upload confidential or private documents to it.
- Tables for future payments/subscriptions and other Nova apps remain closed to direct `anon` and `authenticated` table access unless a specific, reviewed policy is added.

## Production safety

- Keep Supabase Auth SMTP settings unchanged unless deliberately planning an email-provider migration.
- Configure the exact GitHub Pages URL in Supabase Auth's Site URL and allowed redirect URLs.
- Enable Supabase leaked-password protection in Authentication → Settings → Password Security.
- Review Supabase Security Advisors after database changes.
- Never commit `.env`, private keys, SMTP credentials, service-role keys or API tokens.

## Project references

- Live site: https://novaos-original.github.io/buildwitheli-media/
- GitHub repository: https://github.com/NovaOS-original/buildwitheli-media
- Supabase project ref: `xtchvetdluriblzyknhp`
- Supabase project URL: https://xtchvetdluriblzyknhp.supabase.co
