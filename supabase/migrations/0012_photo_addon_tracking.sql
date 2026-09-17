-- Photo add-on was only ever a one-time checkout metadata flag
-- (metadata.photoAddon), never persisted - the admin Add-ons board needs a
-- durable "did this client buy it" flag like smart_food_match_enabled and
-- analytics_reports_enabled already have, set once at initial purchase by
-- stripe-webhook.
alter table public.menus
  add column if not exists photo_addon_enabled boolean not null default false;
