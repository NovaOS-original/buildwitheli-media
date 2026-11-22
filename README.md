# BUILDWITHELI MEDIA

A creator-led publishing platform for approved blog articles and externally hosted vlog embeds.

## Project status

Initial repository setup. The production application is being built in stages. Authentication, Firestore persistence, Paystack payments, moderation, and owner administration must be configured and verified before public launch.

## Planned stack

- React + Vite frontend
- Node.js + Express API
- Firebase Authentication and Cloud Firestore
- Paystack server-side payment initialization, verification, and signed webhooks
- Firebase Storage for media assets

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in credentials locally.
3. Install dependencies with `npm install`.
4. Start development with `npm run dev`.

Never commit `.env`, Firebase service-account JSON, Paystack secret keys, or other credentials. Payment processing must remain in Paystack test mode until explicitly configured for production.

## Security note

A creator submission is private and pending review by default. Only server-authorized moderation may publish it. Admin access must be enforced using a verified Firebase UID and server-side authorization, not a client-side email check.
