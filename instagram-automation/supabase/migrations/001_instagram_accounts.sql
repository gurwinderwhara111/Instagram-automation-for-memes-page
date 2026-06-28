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
