create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

-- Before enabling this cron, add a Supabase Vault secret named:
-- publish_worker_secret
--
-- Its decrypted value must match the PUBLISH_WORKER_SECRET Edge Function secret.
-- This keeps the worker secret out of repo-tracked SQL.
create or replace function public.invoke_publish_due_reel()
returns bigint
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  worker_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into worker_secret
  from vault.decrypted_secrets
  where name = 'publish_worker_secret'
  limit 1;

  if worker_secret is null or length(worker_secret) = 0 then
    raise exception 'Missing Supabase Vault secret: publish_worker_secret';
  end if;

  select net.http_post(
    url := 'https://abnfrtvuxnuslmebcbca.supabase.co/functions/v1/publish-due-reel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', worker_secret
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 120000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_publish_due_reel() from public;
grant execute on function public.invoke_publish_due_reel() to postgres;

-- Remove the broken integration-created placeholder job if it exists.
select cron.unschedule('tst1')
where exists (
  select 1
  from cron.job
  where jobname = 'tst1'
);

select cron.unschedule('publish-due-instagram-reels')
where exists (
  select 1
  from cron.job
  where jobname = 'publish-due-instagram-reels'
);

select cron.schedule(
  'publish-due-instagram-reels',
  '*/5 * * * *',
  $$select public.invoke_publish_due_reel();$$
);
