-- Lets an existing customer add a not-yet-active add-on mid-subscription,
-- self-service, via manage-addons (see addon_token below). Stripe handles
-- the pro-rated charge for the rest of the current year via a real
-- Subscription Item, so it then renews correctly with the base plan next
-- year with no extra bookkeeping on our side.
alter table public.subscriptions
  add column if not exists smart_food_match_item_id text unique,
  add column if not exists analytics_reports_item_id text unique;

-- Deliberately a THIRD token, not a reuse of renewal_token or stats_token.
-- renewal_token's POST only opens a Stripe-hosted checkout page - the
-- customer still confirms on Stripe's own site before money moves.
-- manage-addons' POST charges the customer's saved card directly with no
-- Stripe-hosted confirmation step in between, and (per the plan) this link
-- goes out in every order/renewal confirmation email - at least as often as
-- renewal_token, not the rare cadence that would justify reusing it. See
-- 0009_analytics_reports.sql's reasoning for stats_token - this case is the
-- same shape but with an even more direct payment capability, so it gets
-- its own secret rather than riding along on a token used for something
-- lower-stakes (stats_token) or lower-directness (renewal_token).
alter table public.subscriptions
  add column if not exists addon_token uuid not null default gen_random_uuid();
create index if not exists subscriptions_addon_token_idx on public.subscriptions(addon_token);
