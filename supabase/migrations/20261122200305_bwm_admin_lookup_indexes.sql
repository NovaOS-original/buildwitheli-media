create index if not exists bwm_admin_audit_actor_idx on public.bwm_admin_audit(actor_id);
create index if not exists bwm_announcements_created_by_idx on public.bwm_announcements(created_by);
create index if not exists bwm_app_settings_updated_by_idx on public.bwm_app_settings(updated_by);
create index if not exists bwm_moderation_history_actor_idx on public.bwm_moderation_history(actor_id);
create index if not exists bwm_posts_moderated_by_idx on public.bwm_posts(moderated_by);