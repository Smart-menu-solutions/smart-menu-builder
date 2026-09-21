-- Until now every "owner" policy was `to authenticated using (true)`, i.e.
-- any logged-in Supabase user counted as the owner. That was only safe while
-- nobody else could register; sign-ups are now disabled, and this makes the
-- policies themselves owner-only as a second layer.
--
-- The owner is identified by the verified email in the JWT. Change it here
-- (and only here) if the owner account ever changes.
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'gtsiafitsas@outlook.com'
$$;

-- Read-only tables
drop policy if exists "Owner reads customers" on public.customers;
create policy "Owner reads customers"
  on public.customers for select to authenticated
  using (public.is_owner());

drop policy if exists "Owner reads subscriptions" on public.subscriptions;
create policy "Owner reads subscriptions"
  on public.subscriptions for select to authenticated
  using (public.is_owner());

drop policy if exists "Owner reads orders" on public.orders;
create policy "Owner reads orders"
  on public.orders for select to authenticated
  using (public.is_owner());

drop policy if exists "Owner reads notifications_log" on public.notifications_log;
create policy "Owner reads notifications_log"
  on public.notifications_log for select to authenticated
  using (public.is_owner());

drop policy if exists "Owner reads menu_view_daily" on public.menu_view_daily;
create policy "Owner reads menu_view_daily"
  on public.menu_view_daily for select to authenticated
  using (public.is_owner());

-- Owner-managed tables. The live policy on menus is named "owner manages"
-- while supabase-schema.sql says "owners manage"; drop both spellings.
drop policy if exists "Authenticated owner manages menus" on public.menus;
drop policy if exists "Authenticated owners manage menus" on public.menus;
create policy "Authenticated owners manage menus"
  on public.menus for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Authenticated owners manage restaurant_access" on public.restaurant_access;
create policy "Authenticated owners manage restaurant_access"
  on public.restaurant_access for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Authenticated owners manage restaurant_tables" on public.restaurant_tables;
create policy "Authenticated owners manage restaurant_tables"
  on public.restaurant_tables for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Storage. "Public menu images are readable" and "Anyone can upload an order
-- PDF" stay as they are: the public menu and the order form need them.
drop policy if exists "Owner can read order PDFs" on storage.objects;
create policy "Owner can read order PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'menu-pdfs' and public.is_owner());

drop policy if exists "Authenticated owners upload menu images" on storage.objects;
create policy "Authenticated owners upload menu images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images' and public.is_owner());

drop policy if exists "Authenticated owners delete menu images" on storage.objects;
create policy "Authenticated owners delete menu images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and public.is_owner());

-- order_groups, order_items and waiter_calls intentionally keep RLS with no
-- policies: only the Edge Functions (service role) touch them.
--
-- Not enforced here: MFA. To require the TOTP step as well, add
-- `and (auth.jwt() ->> 'aal') = 'aal2'` inside is_owner().
