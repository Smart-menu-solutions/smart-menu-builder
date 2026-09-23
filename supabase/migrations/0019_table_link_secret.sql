-- Closes a security hole in the printed-table-link design (0017): the guest
-- link's table number is intentionally guessable (it's printed openly on
-- the table), but order-session's GET response also hands back that
-- table's live sessionId - the only thing its POST actions check - so
-- guessing another table's number was enough to both read AND place orders
-- onto that table's tab. link_secret is a second, random value required
-- alongside the table number on every order-session call. Like the table
-- number, it's static per table and never rotates, so a printed/scanned
-- link never needs reprinting - it's just long enough (a full UUID) that it
-- can't be guessed the way a small sequential table number can.

alter table public.restaurant_tables
  add column link_secret uuid not null default gen_random_uuid();
