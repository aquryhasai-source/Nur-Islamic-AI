-- NOT YET APPLIED — needs the owner's explicit OK (these remove permissions). Run in the Supabase SQL editor.
-- Roll back with supabase/migrations/ROLLBACK notes in rollback-2026-10-19.sql.

-- PART A — safe right now (the app never uses these).
drop policy if exists anon_insert_feedback on public.feedback;            -- feedback goes through the send-feedback function
revoke all on all tables in schema public from anon, authenticated;       -- RLS already blocked these; this removes the second lock too
grant insert on public.events, public.error_log to anon;                  -- the only two tables the browser still writes to
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
revoke execute on function public.search_quran_ayahs(text, integer) from public, anon, authenticated;
grant  execute on function public.search_quran_ayahs(text, integer) to service_role;
alter function public.search_quran_ayahs(text, integer) set search_path = public, pg_temp;
alter function public.quran_ayahs_search_vector_update() set search_path = public, pg_temp;

-- PART B — run ONLY after the new app version (zip) is live for a few days, because old app copies still
-- write to push_subscriptions directly.
drop policy if exists anon_select_push_subscriptions on public.push_subscriptions;
drop policy if exists anon_insert_push_subscriptions on public.push_subscriptions;
drop policy if exists anon_update_push_subscriptions on public.push_subscriptions;
drop policy if exists anon_delete_push_subscriptions on public.push_subscriptions;
