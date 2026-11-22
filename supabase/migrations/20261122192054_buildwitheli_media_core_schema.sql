-- BUILDWITHELI MEDIA tables are deliberately namespaced so existing Nova apps remain untouched.
create table if not exists public.bwm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  website text not null default '',
  avatar_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  role text not null default 'CREATOR' check (role in ('CREATOR','OWNER')),
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.bwm_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.bwm_profiles(id) on delete restrict,
  slug text not null unique,
  title text not null check (char_length(title) between 5 and 120),
  excerpt text not null default '',
  body text not null,
  category text not null,
  type text not null check (type in ('ARTICLE','VLOG')),
  video_url text,
  cover_image_url text,
  status text not null default 'PENDING' check (status in ('PENDING','PUBLISHED','REJECTED','DRAFT')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null
);
create index if not exists bwm_posts_public_feed_idx on public.bwm_posts (published_at desc) where status = 'PUBLISHED';
create index if not exists bwm_posts_author_created_idx on public.bwm_posts (author_id, created_at desc);
create index if not exists bwm_posts_moderation_idx on public.bwm_posts (status, created_at desc);
create table if not exists public.bwm_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.bwm_profiles(id) on delete cascade,
  status text not null default 'INACTIVE' check (status in ('ACTIVE','EXPIRED','INACTIVE')),
  started_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists bwm_subscriptions_expiry_idx on public.bwm_subscriptions (expires_at);
create table if not exists public.bwm_transactions (
  reference text primary key,
  user_id uuid not null references public.bwm_profiles(id) on delete restrict,
  amount_pesewas integer not null check (amount_pesewas > 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  status text not null default 'INITIALIZED' check (status in ('INITIALIZED','SUCCESS','FAILED')),
  provider text not null default 'paystack',
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists bwm_transactions_user_created_idx on public.bwm_transactions (user_id, created_at desc);
create table if not exists public.bwm_app_settings (
  id boolean primary key default true check (id = true),
  subscription_price_ghs numeric(10,2) not null default 30 check (subscription_price_ghs between 1 and 10000),
  categories text[] not null default array[]::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.bwm_app_settings (id) values (true) on conflict (id) do nothing;
create table if not exists public.bwm_moderation_history (
  id bigint generated always as identity primary key,
  post_id uuid,
  action text not null check (action in ('SUBMITTED','APPROVE','REJECT','DELETED')),
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bwm_moderation_history_created_idx on public.bwm_moderation_history (created_at desc);
create table if not exists public.bwm_admin_audit (
  id bigint generated always as identity primary key,
  action text not null,
  target_user_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bwm_admin_audit_created_idx on public.bwm_admin_audit (created_at desc);
create table if not exists public.bwm_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 100),
  body text not null check (char_length(body) between 5 and 1000),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bwm_profiles enable row level security;
alter table public.bwm_posts enable row level security;
alter table public.bwm_subscriptions enable row level security;
alter table public.bwm_transactions enable row level security;
alter table public.bwm_app_settings enable row level security;
alter table public.bwm_moderation_history enable row level security;
alter table public.bwm_admin_audit enable row level security;
alter table public.bwm_announcements enable row level security;
revoke all on public.bwm_profiles, public.bwm_posts, public.bwm_subscriptions, public.bwm_transactions,
  public.bwm_app_settings, public.bwm_moderation_history, public.bwm_admin_audit, public.bwm_announcements
  from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.bwm_profiles, public.bwm_posts, public.bwm_subscriptions,
  public.bwm_transactions, public.bwm_app_settings, public.bwm_moderation_history, public.bwm_admin_audit,
  public.bwm_announcements to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Dedicated public-read image bucket; uploads are performed only by the trusted API using service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bwm-creator-media', 'bwm-creator-media', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
