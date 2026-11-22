# Production setup and verification

This repository is prepared for a single-origin Render Node service (frontend + Express API) and Firebase services. The repository changes do not create cloud projects, accept account terms, or set private credentials. Complete the console steps below before public launch.

## 1. Firebase project

1. Create or select the production Firebase project. Enable **Authentication → Email/Password**, create **Cloud Firestore**, and enable **Storage**.
2. Register a Firebase Web App. Copy its config into the Render build environment variables listed below.
3. Create a Firebase Admin service account for the API. Store its project ID, service-account email and private key only in Render's environment settings. Do not upload the JSON key to GitHub or this chat.
4. Create your owner account in Firebase Authentication and verify its email. Copy its immutable UID. Set that same UID in both `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID`. The server uses the former for authorization; the latter only controls the admin navigation display.
5. On your Windows PC, install the Firebase CLI, copy `.firebaserc.example` to `.firebaserc`, replace `YOUR_FIREBASE_PROJECT_ID`, then run:
   ```powershell
   npm install
   npx firebase-tools login
   npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules,storage --project YOUR_FIREBASE_PROJECT_ID
   ```
   Review `firestore.rules` before deployment and replace `REPLACE_WITH_OWNER_FIREBASE_UID` with the owner UID. Do not loosen the deny-by-default rules.
6. Add your production website domain to Firebase Authentication → Settings → Authorized domains. Verify email/password sign-in and creator-owned Storage uploads.

## 2. Render production hosting

1. Sign in to Render and choose **New → Blueprint**. Connect `NovaOS-original/buildwitheli-media` and select branch `main`. Render reads the root `render.yaml` and creates the Node web service.
2. Set every variable marked `sync: false` in the Render service's Environment page. Required variables:
   - `APP_ORIGIN`: the exact public HTTPS origin Render assigns (or your custom domain), e.g. `https://your-service.onrender.com`.
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase Admin service-account values. For the private key, paste the complete PEM private key; preserve newline characters or use escaped `\\n` if the provider requires a single line.
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`: Firebase Web App values.
   - `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID`: the same verified owner UID.
   - `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`: use Paystack TEST keys first.
   - `SUBSCRIPTION_PRICE_GHS`: defaults to `30`.
3. Keep `VITE_API_ORIGIN` empty: the production frontend and API are served from the same origin. The frontend is built during Render's build command, so Firebase `VITE_*` values must be present before the build starts. If you change them later, trigger a fresh deploy.
4. Set `APP_ORIGIN` to the actual public origin after Render creates the service, then redeploy. Add your custom domain in Render if desired and configure its DNS using Render's displayed records. Enable HTTPS.
5. Confirm `https://YOUR_DOMAIN/api/health` returns JSON with `ok: true`. This is a process health check, not proof that Firebase or Paystack credentials work.

## 3. Paystack test mode

1. In the Paystack dashboard, use TEST mode and copy the test public and secret keys into Render. Do not use live keys yet.
2. Add the webhook URL `https://YOUR_DOMAIN/api/payments/webhook` in Paystack. Paystack signs webhook requests with the secret key; the API validates that signature and independently verifies successful transactions before membership activation.
3. Confirm the API's `APP_ORIGIN` matches the public site URL so checkout returns to `/payment/return`.
4. Complete a test checkout using Paystack's official test payment methods. Verify the transaction appears in the creator's payment history and the 30-day membership becomes active only after the signed webhook and server-side verification.
5. Test a declined/cancelled payment, a repeated webhook, a mismatched amount/currency and an expired membership. A browser redirect alone must never activate a membership.
6. Never ask a creator for, or store, their Mobile Money PIN. Do not switch to live mode until test-mode end-to-end checks, access-control review and a small controlled live verification are approved.

## 4. Verification checklist

Run locally from the repository root:
```powershell
npm install
npm test
npm run build
npm start
```

Then verify in the deployed service:
- `GET /api/health` responds successfully.
- Firebase registration, email verification, login and password reset work.
- An authenticated creator can save a profile and upload an image only to their own Storage folder.
- A creator without an active subscription cannot submit content.
- A paid creator's new story remains PENDING until the owner approves it.
- Pending/rejected stories are not visible through public story endpoints or sitemap.
- The owner can access Super Admin; a normal creator receives 403 from admin APIs.
- Paystack test checkout, signed webhook, server verification, payment history and 30-day renewal work.
- Sitemap and canonical URLs use the production HTTPS domain.

GitHub Actions runs unit/source tests and the Vite production build on each push to `main`. It does not test real Firebase or Paystack accounts. Production is not considered fully verified until the live service checks above have been completed.

## 5. Security and operational notes

- Keep all secrets in Render environment settings or a secure local secret manager. Never commit `.env`, service-account JSON or secret keys.
- The Firebase Web API key is a client configuration value, not an Admin credential; protect data with Firebase Security Rules and server-side authorization.
- Back up Firestore before launch and set billing alerts/quotas in Google Cloud and Paystack.
- Add monitoring for failed webhooks, payment reconciliation, Firestore errors and service restarts.
- GitHub Pages cannot host this Express backend. Use the Render Node service defined in `render.yaml`.
