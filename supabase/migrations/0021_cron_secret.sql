-- check-subscriptions and send-weekly-report run with verify_jwt = false,
-- and the cron jobs from 0002/0010 only sent the publishable key - which is
-- public - so anyone could trigger them (send-weekly-report would email
-- every analytics customer again on each call). Both functions now require
-- an x-cron-secret header matching their CRON_SECRET function secret.
--
-- The value itself never lives in git: it's read from Supabase Vault at run
-- time. One-time setup (same value in both places):
--   select vault.create_secret('<random value>', 'cron_secret');
--   supabase secrets set CRON_SECRET=<random value>
-- cron.schedule with an existing job name replaces that job.
select cron.schedule(
  'check-subscriptions-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://qlzugnwsufbgznoawvic.supabase.co/functions/v1/check-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_m7GxKtc8I3F8ASzuMaJvZg_8CQuKToA',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  ) as request_id;
  $$
);

select cron.schedule(
  'send-weekly-report-weekly',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := 'https://qlzugnwsufbgznoawvic.supabase.co/functions/v1/send-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_m7GxKtc8I3F8ASzuMaJvZg_8CQuKToA',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  ) as request_id;
  $$
);
