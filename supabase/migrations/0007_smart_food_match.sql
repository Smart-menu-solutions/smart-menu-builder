alter table public.menus
  add column if not exists smart_food_match_enabled boolean not null default false;
