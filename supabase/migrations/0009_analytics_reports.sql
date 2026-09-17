-- Weekly Analytics Report add-on.
-- Auto-activated by stripe-webhook (unlike smart_food_match_enabled, which
-- is staff-toggled manually in admin.js) - see stripe-webhook/index.ts.
alter table public.menus
  add column if not exists analytics_reports_enabled boolean not null default false;

-- Deliberately NOT reusing renewal_token. renewal_token is emailed at most
-- ~1-2x/year (initial + payment-failed retry) and grants a page that shows
-- PII (name, email, phone, company) and can start a new Stripe checkout.
-- stats_token will be emailed weekly (52x/year) and only ever grants
-- read-only access to aggregate, non-personal traffic counts. Sharing one
-- secret between a rarely-emailed payment-adjacent flow and a routinely-
-- emailed read-only flow means every weekly send becomes a fresh chance to
-- leak the renewal/payment link too - not worth it for one extra
-- `uuid default gen_random_uuid()` column following the exact same pattern
-- renewal_token already established.
alter table public.subscriptions
  add column if not exists stats_token uuid not null default gen_random_uuid();
create index if not exists subscriptions_stats_token_idx on public.subscriptions(stats_token);

-- Bounded daily aggregate, upserted in place - NOT a per-event log. One row
-- per (menu, day, metric type, label). Old rows get pruned by
-- send-weekly-report every Monday, so row growth stays bounded regardless
-- of how many customers or how much traffic accumulates.
create table public.menu_view_daily (
  id uuid primary key default gen_random_uuid(),
  menu_slug text not null references public.menus(slug) on delete cascade,
  day date not null,
  metric_type text not null check (metric_type in ('visit', 'category', 'dish')),
  label text not null default '',
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_slug, day, metric_type, label)
);
create index menu_view_daily_slug_day_idx on public.menu_view_daily(menu_slug, day);

alter table public.menu_view_daily enable row level security;
-- Same convention as customers/subscriptions/orders/notifications_log: no
-- anon/authenticated write policy exists, so only service_role (the Edge
-- Functions) can write. Owner (authenticated) gets read access.
create policy "Owner reads menu_view_daily"
  on public.menu_view_daily for select to authenticated
  using (true);

-- Atomic increment for one page view's worth of data in a single round
-- trip. Needed because concurrent QR scans of the same popular dish during
-- a Friday-night rush are a real scenario, and a plain read-then-upsert
-- from an Edge Function would race under real concurrency. Called only by
-- track-menu-view's service-role client - never exposed to anon.
-- p_categories/p_dishes must arrive de-duplicated (ON CONFLICT DO UPDATE
-- can't affect the same row twice in one statement).
create or replace function public.increment_menu_views(
  p_menu_slug text,
  p_day date,
  p_visit boolean,
  p_categories text[],
  p_dishes text[]
) returns void
language plpgsql
as $$
begin
  if p_visit then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    values (p_menu_slug, p_day, 'visit', '', 1)
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;

  if p_categories is not null and array_length(p_categories, 1) > 0 then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    select p_menu_slug, p_day, 'category', label, 1 from unnest(p_categories) as label
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;

  if p_dishes is not null and array_length(p_dishes, 1) > 0 then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    select p_menu_slug, p_day, 'dish', label, 1 from unnest(p_dishes) as label
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;
end;
$$;
