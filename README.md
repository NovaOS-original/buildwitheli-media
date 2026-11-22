# BUILDWITHELI MEDIA

A creator-led publishing platform for approved blog articles and externally hosted vlog links.

## Current implementation

> **Migration note (2026-11-22):** The live codebase still uses Firebase for authentication and Firestore until the Supabase runtime cutover is completed. The Nova Supabase project now has isolated `bwm_*` tables and a dedicated `bwm-creator-media` bucket provisioned. See [the Supabase migration plan](docs/SUPABASE-MIGRATION.md). Do not remove Firebase configuration or switch production traffic yet.

- Firebase email/password registration, login, verification and password reset.
- Creator workspace for profile editing, subscription status, article/vlog submission, submission tracking and payment history.
- Free early access: no checkout, payment collection or paid subscription requirement. Creator publishing access is enabled after email verification.
- New content is private and pending editorial review until an owner approves it.
- Super Admin dashboard for moderation, user suspension/restoration, transaction review, revenue analytics, featured content, subscription price settings, announcements and CSV transaction export.
- Express API serves the production Vite build when deployed as a Node service.

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in credentials locally.
3. Run `npm install`.
4. Run `npm run dev` (Vite at http://localhost:5173; API at http://localhost:4000).
5. Run `npm test` and `npm run build` before pushing changes.

## Required configuration

- Firebase Authentication (Email/Password), Firestore and a Firebase Admin service account (temporary until the documented Supabase Auth/Postgres cutover).
- Set `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID` to the owner's verified Firebase UID. The server enforces owner access; the Vite value only displays the admin navigation.
- Replace the owner UID placeholder in `firestore.rules` and deploy the rules.
- Payments are disabled for the initial hosted launch. Paystack configuration is intentionally omitted.
- Configure `APP_ORIGIN` and `VITE_API_ORIGIN` for the chosen deployment.

## Production setup

A Render Node-service blueprint is provided in `render.yaml`; Firebase rules deployment configuration is provided in `firebase.json`. Follow [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) to configure the current Firebase-backed API and Render hosting. Payment integration is disabled. Cloud credentials and owner UID must be supplied securely in the provider dashboards; they are not stored in GitHub. Production hosting and real Firebase/Paystack integration are not considered verified until the deployed checks in that guide pass.

The application includes Supabase Storage cover uploads (server-side service-role access), public story/category/sitemap routes, production story metadata, a free early-access publishing mode and unit/source tests. Remaining operational work includes expiry status reconciliation/automation, refunds and chargebacks, media cleanup, scalable admin pagination, and real cloud end-to-end verification.

Never commit `.env`, Firebase service-account JSON, private keys or Supabase service-role keys.


### Creator cover images

Creator cover-image uploads use a public Supabase Storage bucket named `creator-media`. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server only. Uploads are authenticated through Firebase, scoped to the creator's UID folder, and limited to JPG, PNG or WebP up to 8 MB. The Supabase Free plan includes 1 GB file storage; free projects may pause after one week of inactivity.
