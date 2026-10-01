-- SmartService Hub's realtime channel was named after the restaurant's slug
-- alone (restaurant:<slug>), and the slug is public (it's in every menu
-- link). Anyone could subscribe and watch a restaurant's order activity, or
-- send fake events that made every staff screen refetch. The channel name
-- now also carries a random per-restaurant key: restaurant:<slug>:<key>.
-- order-session and staff-access hand it only to callers who passed their
-- own link checks; admin.js (owner) reads it to announce menu changes.
--
-- No foreign key to menus(slug) on purpose: that would block editing a
-- menu's slug in the admin. Rows are created by the two functions on first
-- use (service role), so a renamed menu simply gets a fresh key.
--
-- Undo: drop table public.restaurant_channels;  (and redeploy the old functions)
create table if not exists public.restaurant_channels (
  menu_slug text primary key,
  channel_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.restaurant_channels enable row level security;

-- Owner reads (admin.js); writes only through the Edge Functions' service role.
create policy "Owner reads restaurant_channels"
  on public.restaurant_channels for select to authenticated
  using (public.is_owner());

insert into public.restaurant_channels (menu_slug)
select slug from public.menus where smartservice_hub_enabled
on conflict (menu_slug) do nothing;
