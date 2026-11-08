-- 004_ai_response_log_retention.sql
-- Prepared, NOT executed. Do not schedule the job or delete existing rows.
--
-- Retention for public.ai_response_log, which stores user questions and AI answers.
-- The table is write-only server-side and currently holds 11 rows with no expiry.
--
-- IDEMPOTENCY (revised per audit feedback):
--   cron.schedule() is NOT idempotent. Scheduling a job whose name already exists
--   raises a duplicate-name conflict rather than updating the existing job. This
--   migration therefore guards the schedule call: it only schedules when the job
--   does not already exist, and leaves an existing job untouched. To change an
--   existing job's schedule, use cron.alter_job explicitly — do not re-run this
--   migration.
--
-- The DELETE itself is safe to repeat; it is a plain time-predicate delete.

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-ai-response-logs') THEN
    PERFORM cron.schedule('purge-ai-response-logs', '0 3 * * *',
      $sql$DELETE FROM public.ai_response_log WHERE created_at < now() - interval '90 days'$sql$);
  END IF;
END $block$;

-- PRE-EXECUTION VERIFICATION (all confirmed during the 2026-11-08 audit):
--   1. ai_response_log.created_at exists, type timestamptz, populated (rows dated
--      2026-10-19 .. 2026-11-05). Confirmed.
--   2. pg_cron is available: 5 active jobs (purge-events, purge-rate-limits,
--      daily-hadith-push-9am-local, post-daily-hadith-social-9am-ist,
--      prayer-time-alerts). Confirmed.
--   3. cron.schedule is permitted under the migrations role. Confirmed by the
--      existing 001_security_additive migration using cron.schedule for the same
--      purge jobs.
--   4. purge-ai-response-logs does NOT already exist. Confirmed via cron.job query.
--   5. The job is idempotent: the guarded schedule prevents duplicate-name conflicts,
--      and the DELETE is safe to re-run.