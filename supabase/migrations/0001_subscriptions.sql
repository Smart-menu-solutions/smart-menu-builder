-- Subscription engine: customers, subscriptions, orders, notification log.
-- Written by Edge Functions using the service_role key, which bypasses RLS.
-- The single owner account (authenticated) gets read-only access for the
-- admin dashboard status display. No customer-facing login exists; customers
-- reach their own record only via the unguessable `renewal_token` link in
-- their email.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  email text not null,
  company_name text,
  phone text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  menu_slug text not null references public.menus(slug),
  plan text not null check (plan in ('start', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'expired', 'deactivated', 'cancelled')),
  stripe_subscription_id text unique,
  current_period_start date not null,
  current_period_end date not null,
  grace_until date,
  renewal_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id),
  type text not null check (type in ('initial', 'renewal')),
  pdf_path text not null,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id),
  kind text not null,
  sent_to text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index subscriptions_menu_slug_idx on public.subscriptions(menu_slug);
create index subscriptions_status_idx on public.subscriptions(status);
create index subscriptions_renewal_token_idx on public.subscriptions(renewal_token);
create index orders_subscription_id_idx on public.orders(subscription_id);
create index notifications_log_subscription_id_idx on public.notifications_log(subscription_id);

alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.notifications_log enable row level security;

-- No insert/update/delete policy is defined for anon/authenticated on any of
-- these four tables: with RLS enabled that means only service_role (which
-- bypasses RLS entirely) can write to them, which is exactly the Edge
-- Functions. The owner-only read policies below are select-only.

create policy "Owner reads customers"
  on public.customers for select to authenticated
  using (true);

create policy "Owner reads subscriptions"
  on public.subscriptions for select to authenticated
  using (true);

create policy "Owner reads orders"
  on public.orders for select to authenticated
  using (true);

create policy "Owner reads notifications_log"
  on public.notifications_log for select to authenticated
  using (true);

-- Storage bucket for order/renewal PDF uploads. Private: anonymous visitors
-- (the order form) may only upload, never list or download; the owner
-- (authenticated) can download to review/import a submitted menu.
insert into storage.buckets (id, name, public)
values ('menu-pdfs', 'menu-pdfs', false)
on conflict (id) do nothing;

create policy "Anyone can upload an order PDF"
  on storage.objects for insert to anon
  with check (bucket_id = 'menu-pdfs');

create policy "Owner can read order PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'menu-pdfs');
