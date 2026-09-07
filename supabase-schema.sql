create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  phone text,
  whatsapp text,
  address text,
  currency text not null default '€',
  categories jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menus enable row level security;

create policy "Published menus are public"
  on public.menus for select
  using (is_published = true);

create policy "Authenticated owners manage menus"
  on public.menus for all to authenticated
  using (true) with check (true);
