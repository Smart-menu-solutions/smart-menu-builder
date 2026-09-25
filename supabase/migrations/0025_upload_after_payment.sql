-- Files are now uploaded after payment instead of before it: the order form
-- only takes contact details + plan, Stripe Checkout redirects to
-- upload.html, and the new order-upload function hands out one-off signed
-- upload URLs for orders/<checkout session id>/menu.pdf|photos.zip - but only
-- for a Checkout Session Stripe confirms as paid. So the bucket no longer
-- needs a public insert policy at all (0024 had narrowed it to pending/...).
--
-- upload_token: the customer's personal upload link in the confirmation email
-- (upload.html?token=...), for uploading later than right after checkout.
-- files_uploaded_at / photo_zip_path: set by order-upload once the files have
-- passed its content check.
alter table public.orders
  add column if not exists upload_token uuid not null default gen_random_uuid(),
  add column if not exists files_uploaded_at timestamptz,
  add column if not exists photo_zip_path text;

create unique index if not exists orders_upload_token_key on public.orders (upload_token);

drop policy if exists "Anyone can upload an order PDF" on storage.objects;
