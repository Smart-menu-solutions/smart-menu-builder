-- The public live demo on smartmenusolutions.com (2026-10-07): visitors
-- order at table 12 of the demo restaurant "El Greco" (slug el-greco - its
-- table link is on the website already) and watch the kitchen and bar
-- screens fill up. Both screens open through these two named staff links,
-- shown as "Website-Demo" in the builder - don't delete them while the
-- website links them. The website adds ?demo=1, so staff.js offers no push
-- notifications and no install banner there.
--
-- Every night the demo starts fresh: all open El Greco orders are
-- cancelled ('CANCELLED' - never counted as paid in the hub's day summary),
-- every table is free again and table 12 is opened again, so the next
-- visitor can order right away. Done once right now as well. A DO block in
-- the cron job rather than a function: nothing new that the anon or
-- authenticated roles could call through the API.

insert into public.restaurant_access (menu_slug, role, token, label) values
  ('el-greco', 'kitchen', '798b1138-400e-404b-b7e5-ad36b64158ed', 'Website-Demo'),
  ('el-greco', 'bar', '73780e40-23d2-475a-b122-3117a12c1c59', 'Website-Demo');

select cron.schedule(
  'reset-website-demo',
  '0 2 * * *',
  $job$
  do $reset$
  begin
    update public.order_groups set status = 'CANCELLED', closed_at = now() where menu_slug = 'el-greco' and status = 'OPEN';
    update public.restaurant_tables set status = 'FREE' where menu_slug = 'el-greco' and status <> 'FREE';
    insert into public.order_groups (table_id, menu_slug)
      select id, menu_slug from public.restaurant_tables where menu_slug = 'el-greco' and table_number = '12';
    update public.restaurant_tables set status = 'ACTIVE' where menu_slug = 'el-greco' and table_number = '12';
  end
  $reset$;
  $job$
);

do $reset$
begin
  update public.order_groups set status = 'CANCELLED', closed_at = now() where menu_slug = 'el-greco' and status = 'OPEN';
  update public.restaurant_tables set status = 'FREE' where menu_slug = 'el-greco' and status <> 'FREE';
  insert into public.order_groups (table_id, menu_slug)
    select id, menu_slug from public.restaurant_tables where menu_slug = 'el-greco' and table_number = '12';
  update public.restaurant_tables set status = 'ACTIVE' where menu_slug = 'el-greco' and table_number = '12';
end
$reset$;
