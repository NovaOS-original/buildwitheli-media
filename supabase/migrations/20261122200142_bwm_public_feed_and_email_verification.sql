grant select on public.bwm_posts to anon;
alter table public.bwm_profiles add column if not exists email_verified boolean not null default false;
update public.bwm_profiles p set email_verified=(u.email_confirmed_at is not null) from auth.users u where u.id=p.id;
create or replace function private.bwm_sync_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.bwm_profiles(id,email,email_verified,display_name,role,status,approval_status)
 values(new.id,coalesce(new.email,''),new.email_confirmed_at is not null,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(coalesce(new.email,''),'@',1)),'CREATOR','ACTIVE','PENDING')
 on conflict(id) do update set email=coalesce(new.email,''),email_verified=(new.email_confirmed_at is not null),updated_at=now();
 return new;
end; $$;
drop trigger if exists bwm_sync_auth_user on auth.users;
create trigger bwm_sync_auth_user after insert or update on auth.users for each row execute function private.bwm_sync_auth_user();