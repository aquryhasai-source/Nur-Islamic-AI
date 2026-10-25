-- NŪR rollback snapshot taken 2026-10-19 BEFORE the security changes.
-- Run sections independently in the Supabase SQL editor to undo a specific change.

-- ── 1. Restore original cron commands (jobs 2, 3, 4) ───────────────────────
select cron.alter_job(2, command := $cmd$
  select net.http_post(
    url := 'https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY_FROM_ORIGINAL_JOB>'
    ),
    body := jsonb_build_object(
      'device_id', ps.device_id,
      'title', 'Hadith of the Day',
      'body', dh.hadith_text || ' — ' || dh.reference,
      'url', '/'
    )
  )
  from push_subscriptions ps
  cross join lateral (
    select hadith_text, reference
    from daily_hadiths
    order by id
    offset (
      extract(doy from (now() at time zone coalesce(nullif(ps.timezone, ''), 'UTC')))::int
      % (select count(*) from daily_hadiths)
    )
    limit 1
  ) dh
  where extract(hour from (now() at time zone coalesce(nullif(ps.timezone, ''), 'UTC'))) = 9
    and extract(minute from (now() at time zone coalesce(nullif(ps.timezone, ''), 'UTC'))) < 15;
$cmd$);
-- Jobs 3 and 4: same URL pattern, body '{}'::jsonb, Authorization = Bearer <anon key>, no other headers.
-- (Original anon key = the public SUPABASE_ANON value in src/analytics.js.)

-- ── 2. Re-create policies that were dropped ─────────────────────────────────
create policy anon_insert_feedback on public.feedback for insert to anon with check (true);
-- push_subscriptions policies (dropped only in the later lockdown step):
create policy anon_select_push_subscriptions on public.push_subscriptions for select to anon using (true);
create policy anon_insert_push_subscriptions on public.push_subscriptions for insert to anon with check (true);
create policy anon_update_push_subscriptions on public.push_subscriptions for update to anon using (true) with check (true);
create policy anon_delete_push_subscriptions on public.push_subscriptions for delete to anon using (true);

-- ── 3. Restore the original (broad) grants ──────────────────────────────────
grant all on all tables in schema public to anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
grant execute on function public.search_quran_ayahs(text, integer) to public, anon, authenticated;
alter function public.search_quran_ayahs(text, integer) reset search_path;
alter function public.quran_ayahs_search_vector_update() reset search_path;

-- ── 4. Drop new objects (only if you want a full revert) ────────────────────
-- drop function if exists public.consume_quota(text,text,int), public.refund_quota(text,text),
--   public.hit_rate_limit(text,int,int), public.bind_device_key(text,text), public.redeem_license(text,text,int),
--   public.check_cron_secret(text), public.get_internal_secret();
-- drop table if exists public.rate_limits, public.devices;
-- alter table public.licenses drop column if exists revoked_at;
-- alter table public.events drop constraint if exists events_len;
-- alter table public.error_log drop constraint if exists error_len;
-- select cron.unschedule('purge-rate-limits'); select cron.unschedule('purge-events');
-- delete from vault.secrets where name in ('cron_secret','internal_secret');

-- Edge Function rollback: original deployed versions were nur-proxy v62, send-push v8, send-prayer-alerts v4,
-- post-daily-hadith-social v6, nur-rp-webhook v12, nur-ls-webhook v12, send-feedback v11, daily-hadith v9.
-- Pre-change sources: not bundled; the Supabase dashboard keeps no download, so ask Claude to restore from the saved copy in this chat if ever needed (nur-proxy v62 is also close to the old repo copy, minus later fixes).
