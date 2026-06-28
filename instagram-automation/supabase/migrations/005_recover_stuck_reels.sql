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
