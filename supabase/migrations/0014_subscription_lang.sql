-- Every transactional email (order/renewal confirmation, payment failed,
-- deactivated, add-on added) has so far always been sent in German,
-- regardless of whether the customer ordered from the EN or DE marketing
-- site. Stored once at initial order time and reused for every automated
-- email over the subscription's lifetime, rather than re-detected each
-- time, so language stays consistent even if a customer later clicks a
-- link from the other language's page.
alter table public.subscriptions
  add column if not exists lang text not null default 'de' check (lang in ('de', 'en'));
