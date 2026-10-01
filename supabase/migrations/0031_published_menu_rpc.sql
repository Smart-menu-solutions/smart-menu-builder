-- "Published menus are public" let anyone with the public key list every
-- published menu in one request (/rest/v1/menus?select=name,phone,...) - a
-- ready-made list of all our customers. Guests only ever need the one menu
-- whose slug is in their QR link, so menu.js now loads it through this
-- function, and the table policy is dropped.
--
-- Rollout order (so no guest ever sees an error): 1) this function is
-- created, 2) menu.js/sw.js switch to /rest/v1/rpc/get_published_menu,
-- 3) once that's live and GitHub Pages' cache has expired, the policy below
-- is dropped (it was applied as a separate step for that reason).
--
-- security definer: runs with the owner's rights, so it can read menus
-- without an anon policy - and returns exactly one published menu by slug.
--
-- Undo: create policy "Published menus are public" on public.menus
--   for select using (is_published = true);
create or replace function public.get_published_menu(p_slug text)
returns setof public.menus
language sql
stable
security definer
set search_path = public
as $$
  select * from public.menus where slug = p_slug and is_published = true limit 1;
$$;

revoke execute on function public.get_published_menu(text) from public;
grant execute on function public.get_published_menu(text) to anon, authenticated;

drop policy if exists "Published menus are public" on public.menus;
