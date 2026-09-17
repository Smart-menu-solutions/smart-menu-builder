-- Extends the Weekly Analytics Report add-on (0009_analytics_reports.sql)
-- to also track Smart Food Match recommendations, so the stats page can
-- show "top recommended dish per course" alongside the existing visit/
-- category/dish counters. Reuses the same menu_view_daily table rather
-- than a new one - same bounded-daily-aggregate shape, just a new
-- metric_type. Label format: '<course>::<dish name>', course in
-- ('starter', 'main', 'dessert') matching buildCourseCatalog() in menu.js.

alter table public.menu_view_daily drop constraint menu_view_daily_metric_type_check;
alter table public.menu_view_daily add constraint menu_view_daily_metric_type_check
  check (metric_type in ('visit', 'category', 'dish', 'sfm_reco'));

-- p_recommendations is deduped client-side into a Set before it arrives
-- here (same convention as p_categories/p_dishes - "once per visit", and
-- required so the unnest-based upsert below never tries to affect the same
-- row twice in one statement).
create or replace function public.increment_menu_views(
  p_menu_slug text,
  p_day date,
  p_visit boolean,
  p_categories text[],
  p_dishes text[],
  p_recommendations text[] default null
) returns void
language plpgsql
as $$
begin
  if p_visit then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    values (p_menu_slug, p_day, 'visit', '', 1)
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;

  if p_categories is not null and array_length(p_categories, 1) > 0 then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    select p_menu_slug, p_day, 'category', label, 1 from unnest(p_categories) as label
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;

  if p_dishes is not null and array_length(p_dishes, 1) > 0 then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    select p_menu_slug, p_day, 'dish', label, 1 from unnest(p_dishes) as label
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;

  if p_recommendations is not null and array_length(p_recommendations, 1) > 0 then
    insert into public.menu_view_daily (menu_slug, day, metric_type, label, view_count)
    select p_menu_slug, p_day, 'sfm_reco', label, 1 from unnest(p_recommendations) as label
    on conflict (menu_slug, day, metric_type, label)
    do update set view_count = menu_view_daily.view_count + 1, updated_at = now();
  end if;
end;
$$;
