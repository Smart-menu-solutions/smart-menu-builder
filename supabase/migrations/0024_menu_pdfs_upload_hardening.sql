-- menu-pdfs is writable with the public key (order/renewal forms), and 0022's
-- MIME allowlist only checks the Content-Type the uploader declares: an .exe
-- sent as "application/pdf" was accepted. The real check of the file's bytes
-- happens in create-checkout-session / renewal (and again in stripe-webhook
-- before anything is emailed). This migration narrows what can land in the
-- bucket in the first place:
--
-- 1. A real, server-enforced size limit (Storage rejects bigger uploads
--    itself, whatever the browser says). 50 MB = the order/renewal functions'
--    MAX_UPLOAD_BYTES.
-- 2. Public uploads only under pending/<Date.now()>-<random>-<sanitised name>,
--    exactly what order-form.js / renewal-form.js build - no more writing to
--    arbitrary paths or folders in the bucket.
update storage.buckets
set file_size_limit = 52428800
where id = 'menu-pdfs';

drop policy if exists "Anyone can upload an order PDF" on storage.objects;
create policy "Anyone can upload an order PDF"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'menu-pdfs'
    and name ~ '^pending/[0-9]{13}-[a-z0-9]{1,8}-[A-Za-z0-9._-]{1,200}$'
  );
