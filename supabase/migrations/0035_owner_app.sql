-- "Mein Smart Menu" owner app, 2026-10-06.
--
-- 1. get_published_menu (0031) returned the whole menus row to anyone who
--    knows a slug - and every slug is printed in a public QR code. Since 0034
--    that row carries setup_token, the secret behind servicehub-setup.html
--    (creates tables, stores till numbers). The public read now blanks every
--    secret column; menu.js never used it. Keep this list in sync whenever a
--    secret column is added to menus.
create or replace function public.get_published_menu(p_slug text)
returns setof public.menus
language sql
stable
security definer
set search_path = public
as $$
  select (jsonb_populate_record(null::public.menus, to_jsonb(m) - 'setup_token')).*
  from public.menus m
  where m.slug = p_slug and m.is_published = true
  limit 1;
$$;

-- 2. The owner app link: owner.html?t=<token>. Its own table on purpose,
--    not a menus column, so it can never ride along on a public menu read.
--    The token opens the owner's page (stats, plan, renewal and add-on
--    links, table QR links) through the owner-app Edge Function (service
--    role) - same trust level as the renewal/add-on links we already email
--    to the owner, so it is only ever sent to the owner.
create table if not exists public.owner_app_links (
  menu_slug text primary key references public.menus(slug) on update cascade on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.owner_app_links enable row level security;
drop policy if exists "Owner reads owner_app_links" on public.owner_app_links;
create policy "Owner reads owner_app_links"
  on public.owner_app_links for select to authenticated
  using (public.is_owner());
-- Menus created later get their link the first time the builder copies it.
drop policy if exists "Owner creates owner_app_links" on public.owner_app_links;
create policy "Owner creates owner_app_links"
  on public.owner_app_links for insert to authenticated
  with check (public.is_owner());

insert into public.owner_app_links (menu_slug)
select slug from public.menus
on conflict (menu_slug) do nothing;
