drop policy if exists bwm_posts_creator_insert on public.bwm_posts;
create policy bwm_posts_creator_insert on public.bwm_posts for insert to authenticated
with check (
 author_id=(select auth.uid()) and status in ('PENDING','DRAFT') and featured=false
 and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED' and p.email_verified=true)
);
drop policy if exists bwm_storage_creator_upload on storage.objects;
create policy bwm_storage_creator_upload on storage.objects for insert to authenticated
with check (
 bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED' and p.email_verified=true)
);
drop policy if exists bwm_storage_creator_update on storage.objects;
create policy bwm_storage_creator_update on storage.objects for update to authenticated
using (
 bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED' and p.email_verified=true)
)
with check (
 bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED' and p.email_verified=true)
);
drop policy if exists bwm_storage_creator_delete on storage.objects;
create policy bwm_storage_creator_delete on storage.objects for delete to authenticated
using (
 bucket_id='bwm-creator-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bwm_profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.approval_status='APPROVED' and p.email_verified=true)
);