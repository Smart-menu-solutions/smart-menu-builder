-- login.html only lets the owner into admin.html after the TOTP step, but
-- until now the database itself accepted any owner session - so the
-- password alone was enough to read/write menus, customers, subscriptions
-- etc. straight through the REST API, skipping the Authenticator app. The
-- aal2 check (suggested at the end of 0016_restrict_owner_policies.sql)
-- makes the second factor a database-level requirement too. Every owner
-- policy goes through is_owner(), so this one change covers all of them.
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'gtsiafitsas@outlook.com'
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Postgres grants EXECUTE to PUBLIC by default, so this was callable by
-- anyone via /rest/v1/rpc/increment_menu_views. RLS already made those
-- calls fail, but only track-menu-view (service_role) is meant to call it.
-- 0013 added a parameter, which created a second overload rather than
-- replacing 0009's version, so both signatures exist.
revoke execute on function public.increment_menu_views(text, date, boolean, text[], text[]) from public, anon, authenticated;
revoke execute on function public.increment_menu_views(text, date, boolean, text[], text[], text[]) from public, anon, authenticated;
