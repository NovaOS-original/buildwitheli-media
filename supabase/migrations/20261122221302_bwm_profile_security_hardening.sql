-- Protect auth-managed profile fields and narrow browser-side profile updates.
create or replace function private.bwm_protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := (select auth.uid());
  request_is_owner boolean := private.is_bwm_owner();
begin
  -- Email and verification state are synchronized only from auth.users.
  -- A browser session (including the owner UI) cannot write these fields.
  if request_user_id is not null then
    if new.email_verified is distinct from old.email_verified then
      raise exception 'Email verification is managed by Supabase Auth';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email address is managed by Supabase Auth';
    end if;
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'Profile identity fields cannot be changed';
    end if;
  end if;

  -- Only the active platform owner may manage account and creator permissions.
  if request_user_id = old.id and not request_is_owner then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.approval_status is distinct from old.approval_status then
      raise exception 'Creator access fields can only be changed by a Super Admin';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke update on table public.bwm_profiles from authenticated;
grant update (display_name, bio, website, status, approval_status)
  on table public.bwm_profiles to authenticated;

-- Keep published stories publicly readable without exposing profile email data.
grant select on table public.bwm_posts to anon;
grant select (id, display_name) on table public.bwm_profiles to anon;
grant select on table public.bwm_app_settings, public.bwm_announcements to anon;
