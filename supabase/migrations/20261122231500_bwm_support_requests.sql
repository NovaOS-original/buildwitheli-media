-- Private Super Admin support inbox. Public users can submit requests; only the active owner can read or manage them.
create table if not exists public.bwm_support_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 254),
  category text not null check (category in ('ACCOUNT','CREATOR','CONTENT','COPYRIGHT','PRIVACY','TECHNICAL','OTHER')),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bwm_support_requests_status_created_idx on public.bwm_support_requests(status, created_at desc);
alter table public.bwm_support_requests enable row level security;
revoke all on public.bwm_support_requests from anon, authenticated;
grant insert on public.bwm_support_requests to anon, authenticated;
grant select, update on public.bwm_support_requests to authenticated;
grant all on public.bwm_support_requests to service_role;
create policy bwm_support_public_submit on public.bwm_support_requests
  for insert to anon, authenticated
  with check (
    char_length(name) between 2 and 80
    and char_length(email) between 5 and 254
    and category in ('ACCOUNT','CREATOR','CONTENT','COPYRIGHT','PRIVACY','TECHNICAL','OTHER')
    and char_length(message) between 10 and 5000
    and status = 'OPEN'
  );
create policy bwm_support_owner_read on public.bwm_support_requests
  for select to authenticated using ((select private.is_bwm_owner()));
create policy bwm_support_owner_update on public.bwm_support_requests
  for update to authenticated using ((select private.is_bwm_owner()))
  with check ((select private.is_bwm_owner()));
