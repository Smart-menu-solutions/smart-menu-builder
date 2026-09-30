-- Smart Menu Discovery Pass: a one-off €2.99 payment (Stripe Checkout in
-- payment mode, no Stripe subscription) for a 7-day menu with up to 10
-- dishes and the WeeklyReport stats switched on.
--
-- The 7 days only start once we have set the menu up and published it -
-- check-subscriptions stamps discovery_started_on on the first daily run
-- after menus.is_published turns true, sends the Discovery report on day 6
-- (discovery_report_sent_at keeps it to one mail) and takes the menu offline
-- after day 7. Upgrading goes through the normal renewal link, which turns
-- the same subscription row into a start/pro/premium one.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (plan in ('start', 'pro', 'premium', 'discovery'));

alter table public.subscriptions
  add column if not exists discovery_started_on date,
  add column if not exists discovery_report_sent_at timestamptz;
