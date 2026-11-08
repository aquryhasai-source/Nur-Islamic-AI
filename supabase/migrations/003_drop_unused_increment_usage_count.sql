-- 003_drop_unused_increment_usage_count.sql
-- Prepared, NOT executed.
--
-- Removes public.increment_usage_count(text, text), an unused security-definer
-- service-role function with no quota-limit parameter. It is a free-tier bypass
-- footgun: if any future code path calls it by mistake, the 15-message daily
-- limit is silently removed.
--
-- FINAL DEPENDENCY CHECKS REQUIRED BEFORE EXECUTION:
--   1. SELECT * FROM pg_depend
--        WHERE refobjid = 'public.increment_usage_count(text, text)'::regprocedure;
--      Must return zero rows.
--   2. grep -rn increment_usage_count across the repo and all deployed function
--      bodies. Must return zero hits.
--   3. Confirm no pending migration references it.
--
-- The function is currently unreferenced by any code, trigger, migration, or
-- deployed function (verified during the 2026-11-08 audit). Nothing depends on it.

DROP FUNCTION IF EXISTS public.increment_usage_count(text, text);