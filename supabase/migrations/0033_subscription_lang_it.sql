-- Italian website (2026-10-05): customers who order through it/ get their
-- emails in Italian, so subscriptions.lang also accepts 'it'. Same column,
-- default stays 'de' (see 0014_subscription_lang.sql).
alter table subscriptions drop constraint if exists subscriptions_lang_check;
alter table subscriptions add constraint subscriptions_lang_check check (lang in ('de', 'en', 'it'));
