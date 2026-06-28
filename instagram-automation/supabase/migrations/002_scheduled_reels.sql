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
