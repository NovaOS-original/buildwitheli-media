alter table public.bwm_profiles add column if not exists email text not null default '';
update public.bwm_profiles p set email=u.email from auth.users u where u.id=p.id and p.email='';
create or replace function private.bwm_sync_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.bwm_profiles(id,email,display_name,role,status,approval_status)
 values(new.id,coalesce(new.email,''),coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(coalesce(new.email,''),'@',1)),'CREATOR','ACTIVE','PENDING')
 on conflict(id) do update set email=coalesce(new.email,''),updated_at=now();
 return new;
end; $$;
revoke all on function private.bwm_sync_auth_user() from public,anon,authenticated;
drop trigger if exists bwm_sync_auth_user on auth.users;
create trigger bwm_sync_auth_user after insert or update of email on auth.users for each row execute function private.bwm_sync_auth_user();
grant select on public.bwm_profiles to authenticated;
grant select(id,display_name) on public.bwm_profiles to anon;
create policy bwm_profiles_public_authors on public.bwm_profiles for select to anon,authenticated using(approval_status='APPROVED' and status='ACTIVE');