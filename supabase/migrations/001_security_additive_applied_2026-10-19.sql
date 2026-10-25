-- ALREADY APPLIED to production on 2026-10-19 (additive only; safe to re-run). Kept for the record / new environments.
-- Objects: devices, rate_limits, licenses.revoked_at, events/error_log length checks, purge cron jobs,
-- consume_quota / refund_quota / hit_rate_limit / bind_device_key / redeem_license, check_cron_secret / get_internal_secret.
-- Vault secrets 'cron_secret' and 'internal_secret' were generated inside the database (never displayed).

create table if not exists public.devices (device_id text primary key, key_hash text not null, created_at timestamptz not null default now());
create table if not exists public.rate_limits (key text not null, window_start timestamptz not null, hits integer not null default 0, primary key (key, window_start));
alter table public.devices enable row level security;
alter table public.rate_limits enable row level security;
alter table public.licenses add column if not exists revoked_at timestamptz;
alter table public.events add constraint events_len check (char_length(event) <= 80 and pg_column_size(properties) <= 4096) not valid;
alter table public.error_log add constraint error_len check (char_length(message) <= 500 and char_length(coalesce(context,'')) <= 100 and char_length(coalesce(stack,'')) <= 4000) not valid;

create or replace function public.consume_quota(p_device text, p_date text, p_limit integer)
returns table(allowed boolean, used integer) language plpgsql security definer set search_path = '' as $$
declare v_used int;
begin
  insert into public.usage_log as u (device_id, local_date, count, updated_at) values (p_device, p_date, 1, now())
  on conflict (device_id, local_date) do update set count = u.count + 1, updated_at = now() where u.count < p_limit
  returning u.count into v_used;
  if found then return query select true, v_used; else return query select false, p_limit; end if;
end $$;

create or replace function public.refund_quota(p_device text, p_date text) returns void language sql security definer set search_path = '' as $$
  update public.usage_log set count = greatest(count - 1, 0), updated_at = now() where device_id = p_device and local_date = p_date; $$;

create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); h int;
begin
  insert into public.rate_limits as r(key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1 returning r.hits into h;
  return h <= p_max;
end $$;

create or replace function public.bind_device_key(p_device text, p_key_hash text) returns text language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  insert into public.devices(device_id, key_hash) values (p_device, p_key_hash) on conflict (device_id) do nothing;
  if found then return 'bound'; end if;
  select key_hash = p_key_hash into ok from public.devices where device_id = p_device;
  return case when ok then 'ok' else 'mismatch' end;
end $$;

create or replace function public.redeem_license(p_code text, p_device text, p_max_devices integer) returns text language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  select id, used_by, revoked_at into v from public.licenses where upper(unlock_code) = upper(trim(p_code)) for update;
  if not found or v.revoked_at is not null then return 'invalid'; end if;
  if p_device = any(coalesce(v.used_by, '{}')) then return 'ok'; end if;
  if coalesce(array_length(v.used_by, 1), 0) >= p_max_devices then return 'device_limit'; end if;
  update public.licenses set used_by = array_append(coalesce(used_by, '{}'), p_device) where id = v.id;
  return 'ok';
end $$;

create or replace function public.check_cron_secret(p_secret text) returns boolean language sql stable security definer set search_path = '' as $$
  select p_secret is not null and length(p_secret) >= 32
     and coalesce((select decrypted_secret = p_secret from vault.decrypted_secrets where name = 'cron_secret'), false); $$;
create or replace function public.get_internal_secret() returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'internal_secret'; $$;

-- cron: purge old rows
-- select cron.schedule('purge-rate-limits','17 3 * * *',$$delete from public.rate_limits where window_start < now() - interval '2 days'$$);
-- select cron.schedule('purge-events','23 3 * * *',$$delete from public.events where created_at < now() - interval '90 days'$$);
