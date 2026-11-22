# Local development and service setup

## 1. Requirements
- Node.js 20+
- npm
- A Firebase project with Authentication (Email/Password) and Cloud Firestore enabled

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
4. Register a Web App and copy its public web config to the VITE_FIREBASE_* variables. The project ID is `buildwitheli-media` and the project number / messaging sender ID is `973033606621`; the app ID and API key must come from the Web App config.
5. Create a service account for the API. Keep its private key outside source control and set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in the server environment.
6. Create the owner user through Firebase Authentication, verify the email, then set both OWNER_FIREBASE_UID and VITE_OWNER_FIREBASE_UID to that account's immutable Firebase UID. The VITE value only controls whether the admin navigation is displayed; every admin API independently checks OWNER_FIREBASE_UID on the server. Do not use an email address as the authorization key.
7. Replace REPLACE_WITH_OWNER_FIREBASE_UID in firestore.rules with the same UID and deploy the rules.

## 4. Free early access

- No payment provider, checkout credentials or subscription setup is required for the initial hosted launch.
- Creators can submit content after verifying their email. All submissions remain pending until owner moderation.
- Paystack routes return HTTP 410 while free early access is active. Historical payment records are retained but not displayed in the creator or admin dashboards.

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
- Creator cover-image uploads use Supabase Storage through an authenticated server endpoint. The service-role key remains server-side; only JPG/PNG/WebP up to 8 MB are accepted.
- Payments are disabled for the initial hosted launch. Paystack can be reintroduced later with signed webhook verification and subscription lifecycle tests.
- Add idempotency, webhook replay protection, subscription expiry jobs, refund/chargeback handling and operational alerts.
- Implement dynamic sitemap, canonical URLs, per-article metadata and Article/VideoObject JSON-LD for approved content. The current Vite SPA metadata is only a starter and does not yet provide full SSR.
- Add privacy, terms, contact and editorial policy pages.
- Configure production hosting for the Node API and the current Firebase authentication/database integration. Supabase Auth/Postgres runtime migration remains a separate cutover task. GitHub stores the source; GitHub Pages alone cannot run this Express backend.
- Run security review, integration tests and registration/moderation end-to-end checks before public launch. Payment testing is deferred.

## Secrets
Never commit .env, Firebase service account files, private keys, or Paystack secret keys. Rotate any secret accidentally exposed.


## Supabase Storage (creator cover images)

1. Create or use a Supabase project on the Free plan. Open **Storage → New bucket** and create a bucket named `creator-media`.
2. Set the bucket to **Public** so approved story cover images can be displayed to readers. Do not expose the service-role key in browser code.
3. In Project Settings → API, copy the project URL and the service-role secret into server environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role secret must be stored only in Render/local server environment, never in Vite variables or GitHub.
4. The API authenticates each upload with the existing Firebase ID token, assigns the object path under that creator's Firebase UID, restricts MIME types to JPG/PNG/WebP, and limits uploads to 8 MB. The backend uses the Supabase service role for the upload; browser clients never receive it.
5. Free-plan allowance currently includes 1 GB storage and 5 GB cached plus 5 GB uncached egress; max upload size is 50 MB, while this app intentionally caps cover images at 8 MB. Free projects may pause after a week of inactivity. Monitor usage and remove unused images manually until automated media cleanup is implemented.


## Public stories, categories and sitemap

- Approved articles and vlogs are available through public story pages at `/story/{slug}`. Pending and rejected submissions are never returned by the public detail endpoint.
- Category filters are generated from published content. The public API exposes `/api/public/categories` and supports category filtering on `/api/public/posts`.
- The Node API generates `/sitemap.xml` from the homepage and up to 1,000 currently published stories. Set `APP_ORIGIN` to the canonical public website origin (not the API host if they differ) so sitemap URLs are correct.
- Before launch, replace `YOUR_PUBLIC_DOMAIN` in `public/robots.txt` with the canonical HTTPS domain and submit `/sitemap.xml` in Google Search Console. The story view currently updates title and description client-side; this is not server-side rendering, so rich crawler previews are not guaranteed. SSR or prerendering and per-story Open Graph/Article JSON-LD remain follow-up SEO work.

## Article metadata and vlog playback

- Production story routes resolve only published slugs and return a 404 for missing or unpublished stories.
- Story HTML includes per-article canonical, description, Open Graph, Twitter summary-card metadata and schema.org Article/VideoObject structured data.
- Vlog pages embed YouTube and Vimeo links using privacy-enhanced YouTube embeds where supported. Other video hosts remain ordinary external links.
- Keep APP_ORIGIN set to the canonical public website origin. Replace the placeholder domain in public/robots.txt before launch and ensure the canonical origin matches sitemap output.
