-- contact-form's flood limit only counted contact emails across everyone,
-- so a single bot could use up the limit and block the form for real
-- visitors. The function now also limits per sender: client_hash is an HMAC
-- of the sender's IP (keyed with a server-side secret, so it can't be turned
-- back into the IP) and is cleared again after a day by contact-form itself.
-- Null for every other kind of notification.
--
-- Undo: alter table public.notifications_log drop column client_hash;
alter table public.notifications_log
  add column if not exists client_hash text;

create index if not exists notifications_log_contact_client_idx
  on public.notifications_log (client_hash, created_at)
  where client_hash is not null;
