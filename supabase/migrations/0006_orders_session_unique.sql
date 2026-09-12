-- Defense-in-depth against duplicate Stripe webhook deliveries: the Edge
-- Function already checks for an existing order by stripe_checkout_session_id
-- before writing, but that check-then-insert isn't atomic. A unique index
-- makes a genuinely concurrent duplicate delivery fail the second insert
-- instead of silently creating two customer/subscription/order rows.
create unique index if not exists orders_stripe_checkout_session_id_key
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
