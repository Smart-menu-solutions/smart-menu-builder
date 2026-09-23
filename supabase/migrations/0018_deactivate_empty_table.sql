-- Lets the Admin Hub free a table that was activated by mistake (wrong tile
-- tapped) without a trip through the cashier's "close table" flow, as long
-- as it's still empty. A separate 'CANCELLED' status (not 'PAID') keeps it
-- out of any future revenue/sales total that sums PAID order_groups.

alter table public.order_groups drop constraint order_groups_status_check;
alter table public.order_groups add constraint order_groups_status_check
  check (status in ('OPEN', 'PAID', 'CANCELLED'));
