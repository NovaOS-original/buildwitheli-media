# BUILDWITHELI MEDIA

A creator-led publishing platform for approved blog articles and externally hosted vlog links.

## Current implementation

- Firebase email/password registration, login, verification and password reset.
- Creator workspace for profile editing, subscription status, article/vlog submission, submission tracking and payment history.
- GH₵ subscription checkout initialized server-side through Paystack; only a signed webhook followed by a server-side transaction verification can activate membership.
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

- Firebase Authentication (Email/Password), Firestore and a Firebase Admin service account.
- Set `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID` to the owner's verified Firebase UID. The server enforces owner access; the Vite value only displays the admin navigation.
- Replace the owner UID placeholder in `firestore.rules` and deploy the rules.
- Paystack test secret key and webhook URL for payment testing.
- Configure `APP_ORIGIN` and `VITE_API_ORIGIN` for the chosen deployment.

## Not yet production complete

Media upload, public article detail routes/SSR, full SEO sitemap/schema, payment return UI, expiry automation, refunds/chargebacks, and comprehensive end-to-end tests remain to be completed. Configure a Node host for Express; GitHub Pages alone cannot run the backend. Do not switch Paystack to live mode until security and end-to-end tests have passed.

Never commit `.env`, Firebase service-account JSON, private keys, or Paystack secret keys. Never request or store a Mobile Money PIN.
