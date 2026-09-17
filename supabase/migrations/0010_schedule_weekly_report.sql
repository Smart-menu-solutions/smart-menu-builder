select cron.schedule(
  'send-weekly-report-weekly',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := 'https://qlzugnwsufbgznoawvic.supabase.co/functions/v1/send-weekly-report',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_m7GxKtc8I3F8ASzuMaJvZg_8CQuKToA"}'::jsonb
  ) as request_id;
  $$
);
