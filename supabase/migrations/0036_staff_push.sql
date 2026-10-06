-- Push notifications for the staff screens, 2026-10-06 (staff-push Edge
-- Function). One row per device that switched them on in staff.js: the
-- browser's push endpoint and keys, the staff link it belongs to and the
-- language that screen was in.
--
-- access_id cascades: deleting a staff link in the builder (the way a lost
-- tablet or a former employee's phone is locked out) also stops every push
-- to the devices that used it. access_token is kept only to build the link
-- the notification opens. Only the Edge Function reads or writes this
-- table - RLS on, no policies.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  access_id uuid not null references public.restaurant_access(id) on delete cascade,
  access_token uuid not null,
  menu_slug text not null references public.menus(slug) on update cascade on delete cascade,
  role text not null check (role in ('waiter', 'kitchen', 'bar', 'cashier')),
  p256dh text not null,
  auth text not null,
  lang text not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_menu_role_idx on public.push_subscriptions (menu_slug, role);
create index if not exists push_subscriptions_access_idx on public.push_subscriptions (access_id);

alter table public.push_subscriptions enable row level security;
