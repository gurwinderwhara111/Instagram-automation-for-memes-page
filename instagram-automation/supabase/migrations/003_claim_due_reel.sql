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
