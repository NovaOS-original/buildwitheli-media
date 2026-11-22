# Production setup and verification

This repository is prepared for a single-origin Render Node service (frontend + Express API) and Firebase Auth/Firestore plus Supabase Storage. The repository changes do not create cloud projects, accept account terms, or set private credentials. Complete the console steps below before public launch. **Important:** the current runtime still requires Firebase Auth/Firestore; the planned Supabase Auth/Postgres migration is not yet complete, so this is not yet a Firebase-free deployment.

## 1. Firebase project

1. Create or select the Firebase project. Enable **Authentication → Email/Password** and create **Cloud Firestore**. Image files are stored separately in Supabase Storage.
2. Register a Firebase Web App. Copy its config into the Render build environment variables listed below.
3. Create a Firebase Admin service account for the API. Store its project ID, service-account email and private key only in Render's environment settings. Do not upload the JSON key to GitHub or this chat.
4. Create your owner account in Firebase Authentication and verify its email. Copy its immutable UID. Set that same UID in both `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID`. The server uses the former for authorization; the latter only controls the admin navigation display.
5. On your Windows PC, install the Firebase CLI, copy `.firebaserc.example` to `.firebaserc`, replace `YOUR_FIREBASE_PROJECT_ID`, then run:
   ```powershell
   npm install
   npx firebase-tools login
   npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```
   Review `firestore.rules` before deployment and replace `REPLACE_WITH_OWNER_FIREBASE_UID` with the owner UID. Do not loosen the deny-by-default rules.
6. Add your production website domain to Firebase Authentication → Settings → Authorized domains. Verify email/password sign-in.

## 1A. Supabase Storage (free-tier media bucket)

1. Create/use a Supabase project on the Free plan and create a **Public** bucket named `creator-media`.
2. Copy the project URL and service-role secret from Supabase Project Settings → API.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Render's server environment only. Never use a `VITE_` prefix for the service-role secret and never commit it.
4. Redeploy after setting the variables. Test an authenticated creator image upload; verify the returned public URL loads and the object path starts with that creator's Firebase UID.
5. The app limits cover uploads to 8 MB and JPG/PNG/WebP. Supabase Free currently includes 1 GB file storage and 5 GB cached plus 5 GB uncached egress; free projects may pause after one week of inactivity. Watch usage and keep backups of important media.

## 2. Render production hosting

1. Sign in to Render and choose **New → Blueprint**. Connect `NovaOS-original/buildwitheli-media` and select branch `main`. Render reads the root `render.yaml` and creates the Node web service.
2. Set every variable marked `sync: false` in the Render service's Environment page. Required variables:
   - `APP_ORIGIN`: the exact public HTTPS origin Render assigns (or your custom domain), e.g. `https://your-service.onrender.com`.
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase Admin service-account values. For the private key, paste the complete PEM private key; preserve newline characters or use escaped `\\n` if the provider requires a single line.
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`: Firebase Web App values.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Supabase project URL and server-only service-role secret.
   - `OWNER_FIREBASE_UID` and `VITE_OWNER_FIREBASE_UID`: the same verified owner UID.
   - `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`: use Paystack TEST keys first.
   - `SUBSCRIPTION_PRICE_GHS`: defaults to `30`.
3. Keep `VITE_API_ORIGIN` empty: the production frontend and API are served from the same origin. The frontend is built during Render's build command, so Firebase `VITE_*` values must be present before the build starts. If you change them later, trigger a fresh deploy.
4. Set `APP_ORIGIN` to the actual public origin after Render creates the service, then redeploy. Add your custom domain in Render if desired and configure its DNS using Render's displayed records. Enable HTTPS.
5. Confirm `https://YOUR_DOMAIN/api/health` returns JSON with `ok: true`. This is a process health check, not proof that Firebase credentials work.

## 3. Free early-access launch

- Paystack is not configured or required for the initial launch. The frontend contains no checkout or subscription screens, and all `/api/payments/*` routes return HTTP 410.
- Creators can submit content after verifying their email. Owner moderation remains mandatory before publication.
- Historical payment and subscription records, if any, are retained but are not part of the launch workflow.

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
- A verified creator can submit content without a subscription or payment.
- A paid creator's new story remains PENDING until the owner approves it.
- Pending/rejected stories are not visible through public story endpoints or sitemap.
- The owner can access Super Admin; a normal creator receives 403 from admin APIs.
- Payment routes return HTTP 410 and no Paystack credentials are required.
- Sitemap and canonical URLs use the production HTTPS domain.

GitHub Actions runs unit/source tests and the Vite production build on each push to `main`. It does not test real Firebase or Paystack accounts. Production is not considered fully verified until the live service checks above have been completed.

## 5. Security and operational notes

- Keep all secrets in Render environment settings or a secure local secret manager. Never commit `.env`, service-account JSON or secret keys.
- The Firebase Web API key is a client configuration value, not an Admin credential; protect data with Firebase Security Rules and server-side authorization.
- Back up Firestore before launch and set billing alerts/quotas in Google Cloud and Paystack.
- Add monitoring for failed requests, Firestore errors and service restarts.
- GitHub Pages cannot host this Express backend. Use the Render Node service defined in `render.yaml`.
