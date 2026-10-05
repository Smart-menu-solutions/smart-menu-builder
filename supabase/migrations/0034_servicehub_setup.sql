-- Smart ServiceHub set-up, 2026-10-05.
--
-- 1. The table numbers a customer types on the upload page only went into the
--    internal "Dateien eingegangen" email - when that email failed they were
--    lost. They are kept on the order now (optional, free text).
alter table public.orders add column if not exists table_numbers text;

-- 2. Once we have set up the menu, the customer gets a link to
--    servicehub-setup.html?token=<menus.setup_token>: all their dishes with
--    description and price, a till number field next to each, plus their
--    tables. The servicehub-setup Edge Function (service role) reads the menu
--    by this token, creates missing tables straight away and stores the till
--    numbers as a submission; the builder writes them into the dishes the
--    next time it is opened (applied_at), so a builder tab never overwrites
--    them with an older copy of the menu.
alter table public.menus add column if not exists setup_token uuid not null default gen_random_uuid();
create unique index if not exists menus_setup_token_key on public.menus (setup_token);

create table if not exists public.servicehub_setup_submissions (
  id uuid primary key default gen_random_uuid(),
  menu_slug text not null references public.menus(slug) on update cascade on delete cascade,
  -- { "<dish id>": "350", ... } - every dish the page showed, '' = no number
  numbers jsonb not null default '{}'::jsonb,
  tables_text text,
  tables_created text[] not null default '{}',
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists servicehub_setup_submissions_open on public.servicehub_setup_submissions (menu_slug) where applied_at is null;

alter table public.servicehub_setup_submissions enable row level security;
drop policy if exists "Owner reads servicehub_setup_submissions" on public.servicehub_setup_submissions;
create policy "Owner reads servicehub_setup_submissions"
  on public.servicehub_setup_submissions for select to authenticated
  using (public.is_owner());
drop policy if exists "Owner marks servicehub_setup_submissions applied" on public.servicehub_setup_submissions;
create policy "Owner marks servicehub_setup_submissions applied"
  on public.servicehub_setup_submissions for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());
