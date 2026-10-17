-- ============================================================================
-- VbG Scan · conservazione dei dati (facoltativo, dopo schema.sql)
-- Cancella ogni notte gli eventi più vecchi di 24 mesi.
-- Se dà errore su pg_cron: Database → Extensions → cerca "pg_cron" → Enable, poi riesegui.
-- ============================================================================
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'scan_events_retention';
select cron.schedule(
  'scan_events_retention',
  '17 3 * * *',
  $$delete from public.scan_events where created_at < now() - interval '24 months'$$
);
