-- Copy this whole file into Supabase SQL Editor and click Run.
-- It creates the Instagram account table, scheduled reel queue table,
-- and the claim_due_reel() locking function.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ig_user_id text not null,
  access_token text not null,
  token_expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_accounts_status_check check (status in ('active', 'disabled'))
);

create unique index if not exists instagram_accounts_ig_user_id_idx
  on public.instagram_accounts (ig_user_id);

drop trigger if exists instagram_accounts_set_updated_at on public.instagram_accounts;
create trigger instagram_accounts_set_updated_at
before update on public.instagram_accounts
for each row
execute function public.set_updated_at();

create table if not exists public.scheduled_reels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.instagram_accounts(id),
  title text not null,
  video_path text,
  video_url text not null,
  caption text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  meta_creation_id text,
  meta_publish_id text,
  posted_at timestamptz,
  error_message text,
  attempts integer not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_reels_status_check check (
    status in ('draft', 'scheduled', 'posting', 'posted', 'failed')
  ),
  constraint scheduled_reels_https_video_url check (video_url ~ '^https://')
);

create index if not exists scheduled_reels_due_idx
  on public.scheduled_reels (scheduled_at, created_at)
  where status = 'scheduled';

create index if not exists scheduled_reels_status_idx
  on public.scheduled_reels (status, scheduled_at desc);

create index if not exists scheduled_reels_account_id_idx
  on public.scheduled_reels (account_id);

drop trigger if exists scheduled_reels_set_updated_at on public.scheduled_reels;
create trigger scheduled_reels_set_updated_at
before update on public.scheduled_reels
for each row
execute function public.set_updated_at();

create or replace function public.claim_due_reel()
returns setof public.scheduled_reels
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  update public.scheduled_reels
  set
    status = 'posting',
    attempts = attempts + 1,
    locked_at = now(),
    error_message = null,
    updated_at = now()
  where id = (
    select id
    from public.scheduled_reels
    where status = 'scheduled'
      and scheduled_at <= now()
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit 1
  )
  returning id into claimed_id;

  if claimed_id is null then
    return;
  end if;

  return query
  select *
  from public.scheduled_reels
  where id = claimed_id;
end;
$$;

revoke all on function public.claim_due_reel() from public;
grant execute on function public.claim_due_reel() to service_role;

create or replace function public.recover_stuck_reels(
  max_age_minutes integer default 20,
  max_attempts integer default 5
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer;
begin
  with recovered as (
    update public.scheduled_reels
    set
      status = case
        when attempts >= max_attempts then 'failed'
        else 'scheduled'
      end,
      error_message = case
        when attempts >= max_attempts then
          'Worker lock expired and max automatic attempts were reached. Fix the account/video issue, then retry manually.'
        else
          'Worker lock expired before finishing. Recovered automatically and queued for retry.'
      end,
      locked_at = null,
      updated_at = now()
    where status = 'posting'
      and locked_at is not null
      and locked_at <= now() - make_interval(mins => max_age_minutes)
    returning id
  )
  select count(*) into recovered_count from recovered;

  return recovered_count;
end;
$$;

revoke all on function public.recover_stuck_reels(integer, integer) from public;
grant execute on function public.recover_stuck_reels(integer, integer) to service_role;
