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
6. Create the owner user through Firebase Authentication, verify the email, then set OWNER_FIREBASE_UID to that account's immutable Firebase UID. Do not use an email address as the authorization key.
7. Replace REPLACE_WITH_OWNER_FIREBASE_UID in firestore.rules with the same UID and deploy the rules.

## 4. Paystack test mode
1. Use only the Paystack TEST secret/public keys in development.
2. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY in the server environment.
3. Configure the webhook URL as https://YOUR_API_DOMAIN/api/payments/webhook.
4. Set the webhook signing secret to the Paystack secret key in the API environment. The server validates the x-paystack-signature HMAC and then independently verifies each successful charge with Paystack.
5. Set APP_ORIGIN and API_ORIGIN to the correct local or deployed origins.
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
- Add server-side profile creation and full creator dashboard workflows.
- Add media upload using Firebase Storage with file type/size validation and private pending assets.
- Add admin moderation queues, user suspension, featured content, categories, announcements and audit logs.
- Add payment return verification UI and subscription status/history UI.
- Add idempotency, webhook replay protection, subscription expiry jobs, refund/chargeback handling and operational alerts.
- Implement dynamic sitemap, canonical URLs, per-article metadata and Article/VideoObject JSON-LD for approved content. The current Vite SPA metadata is only a starter and does not yet provide full SSR.
- Add privacy, terms, contact and editorial policy pages.
- Configure production hosting for the Node API and Firebase. GitHub stores the source; GitHub Pages alone cannot run this Express backend.
- Run security review, integration tests and real end-to-end Paystack test-mode checks before public launch.

## Secrets
Never commit .env, Firebase service account files, private keys, or Paystack secret keys. Rotate any secret accidentally exposed.
