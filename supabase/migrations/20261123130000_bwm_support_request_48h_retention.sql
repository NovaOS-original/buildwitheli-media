-- Keep Help requests in the active Super Admin inbox for 48 hours only.
-- After 48 hours, delete the complete request permanently from the database.
delete from public.bwm_support_requests
where created_at <= now() - interval '48 hours';

-- Replace any prior copy of this retention job so it cannot run twice.
select cron.unschedule(jobid)
from cron.job
where jobname = 'bwm-support-requests-retention';

select cron.schedule(
  'bwm-support-requests-retention',
  '0 * * * *',
  $$delete from public.bwm_support_requests where created_at <= now() - interval '48 hours';$$
);
