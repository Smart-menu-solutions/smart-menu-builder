-- SmartService Hub: live ordering (guest QR -> kitchen/bar/waiter/cashier).
--
-- Two different trust levels among the five new tables:
-- - restaurant_access and restaurant_tables are *configuration* the owner
--   manages from admin.html, same as menus.categories - so, like menus,
--   they get a permissive "authenticated" policy below.
-- - order_groups/order_items/waiter_calls are live data written by
--   anonymous guests and PIN-less staff links with no Supabase session at
--   all, so - same pattern as customers/subscriptions/orders in
--   0001_subscriptions.sql - they get NO anon/authenticated policy. With
--   RLS enabled and no policy, only service_role (the order-session and
--   staff-access Edge Functions) can touch them; a token in the URL is the
--   only credential, validated inside those functions, never by Postgres.

alter table public.menus
  add column if not exists smartservice_hub_enabled boolean not null default false;

-- Mirrors smart_food_match_item_id/analytics_reports_item_id from
-- 0011_midyear_addon_purchase.sql - tracks the Stripe Subscription Item for
-- a mid-year purchase so it renews correctly with the base plan next year.
alter table public.subscriptions
  add column if not exists smartservice_hub_item_id text unique;

-- One secret link per role per restaurant (waiter/kitchen/bar/cashier),
-- deliberately four separate tokens rather than one shared link - losing a
-- kitchen tablet only means rotating the kitchen link, not all four.
create table public.restaurant_access (
  id uuid primary key default gen_random_uuid(),
  menu_slug text not null references public.menus(slug),
  role text not null check (role in ('waiter', 'kitchen', 'bar', 'cashier')),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (menu_slug, role)
);

-- qr_token is the guest-facing credential (menu.html?t=<qr_token>). It
-- rotates every time the cashier closes the table (see staff-access's
-- close_table action) so an old photographed QR code stops working the
-- moment that table's round is settled.
create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  menu_slug text not null references public.menus(slug),
  table_number text not null,
  qr_token uuid not null default gen_random_uuid(),
  status text not null default 'FREE' check (status in ('FREE', 'ACTIVE', 'PAYMENT_PENDING')),
  created_at timestamptz not null default now(),
  unique (menu_slug, table_number)
);

create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id),
  menu_slug text not null references public.menus(slug),
  status text not null default 'OPEN' check (status in ('OPEN', 'PAID')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  -- Set when the guest taps "Rechnung anfordern". Persisted, not just a
  -- transient broadcast, so a table's bill request still shows on the
  -- waiter/cashier card even if nobody's screen was open at that exact
  -- moment.
  bill_requested_at timestamptz
);

-- Enforces "always exactly one active round per table" at the DB level,
-- not just in application logic.
create unique index order_groups_one_open_per_table
  on public.order_groups(table_id) where status = 'OPEN';

-- Append-only by design (see design notes): a reorder or an addition from
-- the waiter/bar/cashier is always a new row, never an edit to an existing
-- one, so concurrent writers from different roles never conflict.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references public.order_groups(id),
  -- Usually the same table as the order_group's own table; differs only
  -- when a guest at one table has the waiter send a round to another
  -- table's kitchen/bar queue while it still bills to this order_group.
  serve_table_id uuid not null references public.restaurant_tables(id),
  -- The dish's id from menus.categories[].items[].id (see admin.js/menu.js
  -- changes) - not a foreign key, since it lives inside a jsonb column, not
  -- a relational table.
  product_id text not null,
  -- Snapshot at order time, not a live join: menus are mutable jsonb blobs
  -- the owner can edit anytime, so a later price/name edit must not change
  -- what already-placed orders show.
  product_name text not null,
  unit_price_cents integer not null,
  station text not null check (station in ('KITCHEN', 'BAR')),
  quantity integer not null default 1,
  notes text,
  source text not null check (source in ('GUEST', 'WAITER', 'BAR', 'CASHIER')),
  -- 1 = the table's first order this round, 2+ = a later Nachbestellung -
  -- kitchen/bar prioritise anything above round 1.
  round_number integer not null default 1,
  -- null = still open (red dot), set = dispatched/confirmed at the pass
  -- (green dot). Nothing removes a row from the kitchen/bar view based on
  -- this - only the cashier's close_table action clears a table's rows
  -- from every active view at once.
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index order_items_order_group_idx on public.order_items(order_group_id);
create index order_groups_table_idx on public.order_groups(table_id, status);
create index restaurant_tables_menu_slug_idx on public.restaurant_tables(menu_slug);
create index restaurant_tables_qr_token_idx on public.restaurant_tables(qr_token);
create index restaurant_access_token_idx on public.restaurant_access(token);
create index waiter_calls_table_idx on public.waiter_calls(table_id) where resolved_at is null;

alter table public.restaurant_access enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.order_groups enable row level security;
alter table public.order_items enable row level security;
alter table public.waiter_calls enable row level security;

-- Owner-managed configuration, same trust level as menus (see
-- "Authenticated owners manage menus" in supabase-schema.sql).
create policy "Authenticated owners manage restaurant_access"
  on public.restaurant_access for all to authenticated
  using (true) with check (true);

create policy "Authenticated owners manage restaurant_tables"
  on public.restaurant_tables for all to authenticated
  using (true) with check (true);
