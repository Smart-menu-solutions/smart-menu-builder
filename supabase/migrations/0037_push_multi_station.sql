-- One device can now get push notifications for several staff links, e.g.
-- bar and cashier on the same phone in a small venue (user's request,
-- 2026-10-06). A browser has a single push endpoint per site, so the key
-- becomes the device AND the link instead of the device alone; switching
-- one station off deletes only that station's row (see staff-push).
alter table public.push_subscriptions drop constraint if exists push_subscriptions_pkey;
alter table public.push_subscriptions add constraint push_subscriptions_pkey primary key (endpoint, access_id);
