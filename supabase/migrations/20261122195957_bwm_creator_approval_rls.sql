create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter table public.bwm_profiles add column if not exists approval_status text not null default 'PENDING' check (approval_status in ('PENDING','APPROVED','REJECTED'));
create or replace function private.is_bwm_owner() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.role='OWNER' and p.status='ACTIVE');
$$;
revoke all on function private.is_bwm_owner() from public,anon;
grant execute on function private.is_bwm_owner() to authenticated;
create or replace function private.bwm_protect_profile_fields() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid())=old.id and not private.is_bwm_owner() then
  if new.role is distinct from old.role or new.status is distinct from old.status or new.approval_status is distinct from old.approval_status then
   raise exception 'Creator access fields can only be changed by a Super Admin';
  end if;
 end if;
 new.updated_at=now(); return new;
end; $$;
revoke all on function private.bwm_protect_profile_fields() from public,anon,authenticated;
drop trigger if exists bwm_profiles_protect_fields on public.bwm_profiles;
create trigger bwm_profiles_protect_fields before update on public.bwm_profiles for each row execute function private.bwm_protect_profile_fields();
create or replace function private.bwm_handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.bwm_profiles(id,display_name,role,status,approval_status)
 values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(coalesce(new.email,''),'@',1)),'CREATOR','ACTIVE','PENDING')
 on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function private.bwm_handle_new_user() from public,anon,authenticated;
drop trigger if exists bwm_on_auth_user_created on auth.users;
create trigger bwm_on_auth_user_created after insert on auth.users for each row execute function private.bwm_handle_new_user();
grant select,insert,update on public.bwm_profiles to authenticated;
grant select,insert,update,delete on public.bwm_posts to authenticated;
grant select on public.bwm_app_settings,public.bwm_announcements to anon,authenticated;
grant update on public.bwm_app_settings to authenticated;
grant insert,select on public.bwm_announcements to authenticated;
grant insert,select on public.bwm_moderation_history,public.bwm_admin_audit to authenticated;
grant usage,select on all sequences in schema public to service_role;
grant usage,select on sequence public.bwm_moderation_history_id_seq,public.bwm_admin_audit_id_seq to authenticated;
create policy bwm_profiles_read on public.bwm_profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_bwm_owner()));
create policy bwm_profiles_update on public.bwm_profiles for update to authenticated using(id=(select auth.uid()) or (select private.is_bwm_owner())) with check(id=(select auth.uid()) or (select private.is_bwm_owner()));
create policy bwm_posts_public_or_owner_read on public.bwm_posts for select to anon,authenticated using(status='PUBLISHED' or author_id=(select auth.uid()) or (select private.is_bwm_owner()));
create policy bwm_posts_creator_insert on public.bwm_posts for insert to authenticated with check(author_id=(select auth.uid()) and status in ('PENDING','DRAFT') and featured=false and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED'));
create policy bwm_posts_owner_update on public.bwm_posts for update to authenticated using((select private.is_bwm_owner())) with check((select private.is_bwm_owner()));
create policy bwm_posts_creator_delete on public.bwm_posts for delete to authenticated using(author_id=(select auth.uid()) and status='DRAFT');
create policy bwm_settings_public_read on public.bwm_app_settings for select to anon,authenticated using(true);
create policy bwm_settings_owner_update on public.bwm_app_settings for update to authenticated using((select private.is_bwm_owner())) with check((select private.is_bwm_owner()));
create policy bwm_announcements_public_read on public.bwm_announcements for select to anon,authenticated using(active=true or (select private.is_bwm_owner()));
create policy bwm_announcements_owner_insert on public.bwm_announcements for insert to authenticated with check((select private.is_bwm_owner()));
create policy bwm_announcements_owner_update on public.bwm_announcements for update to authenticated using((select private.is_bwm_owner())) with check((select private.is_bwm_owner()));
create policy bwm_moderation_owner_read on public.bwm_moderation_history for select to authenticated using((select private.is_bwm_owner()) or actor_id=(select auth.uid()));
create policy bwm_moderation_creator_submit on public.bwm_moderation_history for insert to authenticated with check(actor_id=(select auth.uid()) and action='SUBMITTED' and exists(select 1 from public.bwm_posts p where p.id=post_id and p.author_id=(select auth.uid())));
create policy bwm_moderation_owner_insert on public.bwm_moderation_history for insert to authenticated with check((select private.is_bwm_owner()));
create policy bwm_audit_owner_read on public.bwm_admin_audit for select to authenticated using((select private.is_bwm_owner()));
create policy bwm_audit_owner_insert on public.bwm_admin_audit for insert to authenticated with check((select private.is_bwm_owner()));
create policy bwm_storage_creator_upload on storage.objects for insert to authenticated with check(bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy bwm_storage_creator_update on storage.objects for update to authenticated using(bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy bwm_storage_creator_delete on storage.objects for delete to authenticated using(bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text);