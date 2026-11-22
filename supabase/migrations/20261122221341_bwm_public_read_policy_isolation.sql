-- Keep anonymous public feed reads independent from private owner-only helpers.
-- This lets logged-out visitors read published stories while all unpublished content
-- remains visible only to its author and the active platform owner.

drop policy if exists bwm_posts_public_or_owner_read on public.bwm_posts;
create policy bwm_posts_public_read
  on public.bwm_posts for select to anon
  using (status = 'PUBLISHED');
create policy bwm_posts_authenticated_read
  on public.bwm_posts for select to authenticated
  using (
    status = 'PUBLISHED'
    or author_id = (select auth.uid())
    or (select private.is_bwm_owner())
  );

drop policy if exists bwm_announcements_public_read on public.bwm_announcements;
create policy bwm_announcements_public_read
  on public.bwm_announcements for select to anon
  using (active = true);
create policy bwm_announcements_authenticated_read
  on public.bwm_announcements for select to authenticated
  using (active = true or (select private.is_bwm_owner()));
