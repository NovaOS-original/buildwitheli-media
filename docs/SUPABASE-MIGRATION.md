# Supabase implementation status — BUILDWITHELI MEDIA

## Active project

BUILDWITHELI MEDIA currently uses the existing Nova Supabase project:

- Project ref: `xtchvetdluriblzyknhp`
- Project URL: https://xtchvetdluriblzyknhp.supabase.co
- Region: `eu-west-1`

Nova hosts other applications too. Do not rename, drop, truncate, or repurpose their tables, buckets, or Edge Functions.

## Current runtime

The production frontend is a React/Vite static site on GitHub Pages. It connects directly to Supabase using the project's browser-safe publishable key.

- Supabase Auth handles creator registration, email verification, login and password reset.
- Postgres stores BWM profiles, stories, moderation, settings, announcements, support requests and audit records.
- Supabase Storage hosts creator cover images.
- No Firebase Auth/Firestore or Express/Render backend is required by the current publishing frontend.
- Existing Gmail SMTP for Supabase Auth is intentionally retained.
- Resend-based creator notification emails are postponed until a verified sending domain is available.

## BWM data isolation and security

BWM data uses the `bwm_*` namespace. Row Level Security is enabled on the BWM tables.

Recent security hardening:

- Replaced broad profile SELECT policies with a single scoped policy.
- Revoked table-wide profile SELECT and granted only the profile columns needed by each client role.
- Public visitors can read only approved/active creator IDs and display names.
- Authenticated users cannot select creator email addresses or email-verification fields through the table API.
- Super Admin user listings call `public.bwm_admin_list_profiles()`, an invoker wrapper around a private, owner-checked function. Anonymous users cannot execute the RPC.
- Creator media upload/update/delete policies check the signed-in user's own folder and a private server-side eligibility check.
- Consolidated duplicate BWM moderation-history INSERT and post DELETE policies.
- Revoked direct `anon` and `authenticated` table privileges from future payment/subscription tables and unrelated Nova application tables that intentionally have no client RLS policies.

The `bwm-creator-media` bucket is public so published cover images can be served to visitors. It has an 8 MiB limit and allows JPG, PNG and WebP. Do not use it for confidential material.

## Other Nova applications

The following are not part of the BWM publishing frontend and must remain untouched unless separately requested:

- Existing LoveSpark tables and the `lovespark-link` Edge Function.
- Social media publishing tables, the `social-media-ingest` Edge Function and `social-media-published` bucket.
- Other Nova OS tables and application resources.

Direct Data API privileges for tables without client-facing RLS policies have been revoked. Trusted Edge Functions using server-side credentials are not affected by these table grants.

## Backup and change discipline

Nova is the active project, not a second independent backup. Keep independent backups of important data and media. Before future schema changes:

1. Inspect existing policies, grants, triggers and functions.
2. Make the smallest isolated change.
3. Verify grants and RLS behavior after the change.
4. Run Supabase Security and Performance Advisors.
5. Never expose service-role keys or SMTP/API secrets in the browser or GitHub.
