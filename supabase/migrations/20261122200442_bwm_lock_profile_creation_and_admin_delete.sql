revoke insert on public.bwm_profiles from authenticated;
drop policy if exists bwm_posts_owner_delete on public.bwm_posts;
create policy bwm_posts_owner_delete on public.bwm_posts for delete to authenticated
using ((select private.is_bwm_owner()));
