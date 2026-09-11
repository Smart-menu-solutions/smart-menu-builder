select cron.schedule(
  'check-subscriptions-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://qlzugnwsufbgznoawvic.supabase.co/functions/v1/check-subscriptions',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_m7GxKtc8I3F8ASzuMaJvZg_8CQuKToA"}'::jsonb
  ) as request_id;
  $$
);
