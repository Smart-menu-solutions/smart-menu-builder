-- SmartService Hub v2: staff-driven table activation instead of a rotating
-- per-table secret. The guest link becomes menu.html?client=<slug>&table=
-- <table_number> - the table number was never a secret (it's printed on the
-- table itself), so nothing needs to be hidden in the printed code anymore,
-- and it never needs reprinting. Security now lives entirely server-side:
-- only an OPEN order_groups row for a table is a valid "session", and its
-- id (already a random UUID, never shown to the guest) is what the guest's
-- browser holds in memory and must present on every write. Closing a table
-- retires that id for good; the next activation (staff-triggered, from the
-- new Table Hub view) creates a brand-new one.

alter table public.restaurant_tables drop column if exists qr_token;
drop index if exists restaurant_tables_qr_token_idx;

-- "Kellner rufen" is gone - staff watch the Table Hub instead of a call queue.
drop table if exists public.waiter_calls;
