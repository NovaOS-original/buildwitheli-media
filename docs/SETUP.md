# Local development and service setup

## 1. Requirements
- Node.js 20+
- npm
- A Firebase project with Authentication (Email/Password) and Cloud Firestore enabled
- A Paystack account with TEST keys for development

## 2. Install
```bash
npm install
cp .env.example .env
npm run dev
```
The Vite app runs at http://localhost:5173 and the API at http://localhost:4000.

## 3. Firebase
1. Create a Firebase project.
2. Enable Email/Password in Authentication.
3. Create a Firestore database.
4. Register a Web App and copy its public web config to the VITE_FIREBASE_* variables.
5. Create a service account for the API. Keep its private key outside source control and set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in the server environment.
6. Create the owner user through Firebase Authentication, verify the email, then set both OWNER_FIREBASE_UID and VITE_OWNER_FIREBASE_UID to that account's immutable Firebase UID. The VITE value only controls whether the admin navigation is displayed; every admin API independently checks OWNER_FIREBASE_UID on the server. Do not use an email address as the authorization key.
7. Replace REPLACE_WITH_OWNER_FIREBASE_UID in firestore.rules with the same UID and deploy the rules.

## 4. Paystack test mode
1. Use only the Paystack TEST secret/public keys in development.
2. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY in the server environment.
3. Configure the webhook URL as https://YOUR_API_DOMAIN/api/payments/webhook.
4. Set the webhook signing secret to the Paystack secret key in the API environment. The server validates the x-paystack-signature HMAC and then independently verifies each successful charge with Paystack.
5. Set APP_ORIGIN to the correct web origin and VITE_API_ORIGIN to the API origin (use http://localhost:4000 locally).
6. Test with Paystack's published test payment methods. Never ask for or store a Mobile Money PIN.
7. A subscription is written only after the server-side transaction verification succeeds and matches the stored user, amount and currency.

## 5. Build and run
```bash
npm run build
NODE_ENV=production npm start
```
The Node server serves the Vite build in production. Keep the API and web app on the same origin or configure CORS deliberately.

## Important launch checklist
- Configure Firebase Authentication, Firestore and a real owner UID.
- Creator workspace now includes profile editing, membership status, submission form, submission status and payment history.
- Super Admin API/UI now includes moderation, user suspension/restoration, transactions, revenue analytics, featured content, subscription pricing, announcements and transaction CSV export.
- Media upload using Firebase Storage with file type/size validation and private pending assets is still outstanding.
- Payment status is verified by the signed server webhook; a dedicated payment-return status page and automated expiry/refund/chargeback workflows are still outstanding.
- Add idempotency, webhook replay protection, subscription expiry jobs, refund/chargeback handling and operational alerts.
- Implement dynamic sitemap, canonical URLs, per-article metadata and Article/VideoObject JSON-LD for approved content. The current Vite SPA metadata is only a starter and does not yet provide full SSR.
- Add privacy, terms, contact and editorial policy pages.
- Configure production hosting for the Node API and Firebase. GitHub stores the source; GitHub Pages alone cannot run this Express backend.
- Run security review, integration tests and real end-to-end Paystack test-mode checks before public launch.

## Secrets
Never commit .env, Firebase service account files, private keys, or Paystack secret keys. Rotate any secret accidentally exposed.


## Firebase Storage (creator cover images)

1. In the Firebase console, open **Storage** and create/enable the default bucket for the same Firebase project used by Authentication and Firestore.
2. Copy the exact bucket name shown in Firebase project settings into `VITE_FIREBASE_STORAGE_BUCKET` in your local `.env` file.
3. Deploy the repository's `storage.rules` file using the Firebase CLI: `firebase deploy --only storage` after selecting the correct Firebase project.
4. Creator submissions can upload JPG, PNG or WebP cover images up to 8 MB. Storage rules allow public reads and authenticated writes only inside the uploader's own UID folder. Do not weaken these rules to allow anonymous uploads.
5. Test with a non-owner creator account before enabling production uploads. Deleting a post does not yet automatically delete its stored image; media cleanup remains a future task.


## Public stories, categories and sitemap

- Approved articles and vlogs are available through public story pages at `/story/{slug}`. Pending and rejected submissions are never returned by the public detail endpoint.
- Category filters are generated from published content. The public API exposes `/api/public/categories` and supports category filtering on `/api/public/posts`.
- The Node API generates `/sitemap.xml` from the homepage and up to 1,000 currently published stories. Set `APP_ORIGIN` to the canonical public website origin (not the API host if they differ) so sitemap URLs are correct.
- Before launch, replace `YOUR_PUBLIC_DOMAIN` in `public/robots.txt` with the canonical HTTPS domain and submit `/sitemap.xml` in Google Search Console. The story view currently updates title and description client-side; this is not server-side rendering, so rich crawler previews are not guaranteed. SSR or prerendering and per-story Open Graph/Article JSON-LD remain follow-up SEO work.
