# Production deployment — BUILDWITHELI MEDIA

## Hosting

The active frontend is a static React/Vite site hosted on GitHub Pages:

- Site: https://novaos-original.github.io/buildwitheli-media/
- Repository: https://github.com/NovaOS-original/buildwitheli-media
- Production branch: `main`

GitHub Actions builds the frontend and publishes the Vite output to GitHub Pages. GitHub Pages does not run a Node/Express server.

## Supabase configuration

The frontend connects to the Nova project:

- Project ref: `xtchvetdluriblzyknhp`
- URL: https://xtchvetdluriblzyknhp.supabase.co

The browser uses a Supabase publishable key from `src/supabase.js`. Publishable keys are designed for client use; database safety must come from RLS and grants, not hiding this key.

### Authentication URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Set the Site URL to `https://novaos-original.github.io/buildwitheli-media/`.
- Add the same exact URL to the allowed redirect URLs.
- Keep any other redirect URLs only if they are still actively used and trusted.

### Authentication email

The existing Gmail custom SMTP configuration is working and must not be changed as part of routine site hardening. Supabase Auth uses it for verification and password-reset messages.

### Leaked password protection

The site enforces a 12-character minimum with uppercase/lowercase letters, a number and a symbol in its registration and password-change forms. Set the same minimum length and character requirements in Supabase Authentication → Settings if those controls are available in your project. Supabase's built-in **Leaked Password Protection** uses the HaveIBeenPwned Pwned Passwords API, but Supabase documents this feature as Pro plan and above; it cannot be enabled on the current Free plan. Do not claim this check is active until the project is upgraded and the setting is enabled.

### Storage

The BWM cover-image bucket is `bwm-creator-media`:

- Public read is enabled so published cover images can display on the public website.
- Uploads are restricted by Storage RLS to an authenticated, email-verified, approved and active creator.
- Object paths must begin with that creator's Auth UID.
- Maximum file size is 8 MiB.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.

Because this bucket is public, do not store identity documents, private images or other confidential files in it.

## Local verification

From the repository root:

```bash
npm install
npm test
npm run build
```

The build's sitemap generator retrieves published BWM story metadata using the public Supabase REST API. It must never use a service-role key. If the sitemap generation fails, investigate the Supabase response and do not publish a stale or empty sitemap as if it were current.

## Security rules

- Keep Supabase service-role keys, SMTP passwords, Resend keys and all other secrets server-side in the appropriate provider secret store.
- Never add secrets to source code, GitHub commits, frontend HTML, or `VITE_*` variables.
- Keep RLS enabled on every exposed public-schema table.
- Do not grant `TRUNCATE`, broad table privileges, or profile-email access to `anon` or `authenticated` roles.
- Do not weaken the BWM owner checks or profile-protection trigger.
- Do not modify unrelated Nova application tables, buckets or Edge Functions as part of a BWM release.
- Review Supabase Security Advisors after migrations and periodically thereafter.

## Launch verification checklist

- [ ] GitHub Pages deployment succeeds and the public homepage loads.
- [ ] Creator registration and verification email work.
- [ ] Sign-in, sign-out and password reset work.
- [ ] Supabase Auth minimum length and character requirements match the site's 12-character password policy.\n- [ ] If the project is upgraded to Pro or above, enable and verify Supabase Leaked Password Protection.
- [ ] An unapproved creator cannot submit content or upload cover media.
- [ ] An approved creator can submit a story and upload only to their own UID folder.
- [ ] Pending/rejected content is not visible publicly.
- [ ] Approved stories display the correct creator display name and cover image.
- [ ] Non-owner users cannot access Super Admin data or actions.
- [ ] Super Admin can view creator emails through the guarded user-list RPC.
- [ ] Support requests are visible only to the Super Admin.
- [ ] Terms & Conditions and Privacy Policy links work.
- [ ] Supabase Security Advisors have been reviewed and remaining warnings documented.

## Deliberately postponed

Creator approval/rejection notification emails through Resend are postponed until a verified sending domain is available. The existing Gmail SMTP authentication flow remains active and unchanged. Payments are also disabled for the current free early-access launch.
