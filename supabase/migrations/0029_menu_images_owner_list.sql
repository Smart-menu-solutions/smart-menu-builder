-- "Public menu images are readable" (0004) was a SELECT policy for every role,
-- so anyone with the public key could LIST the whole menu-images bucket -
-- including table-qr/<slug>/*.png, whose QR codes carry each table's
-- link_secret (see 0019_table_link_secret.sql and tableQrImageUrl() in
-- admin.js). Listing those files was enough to read and order onto any table.
--
-- The bucket stays public: /storage/v1/object/public/... URLs (menu photos,
-- logos, header backgrounds, the QR images in emails) are served without any
-- policy. Only the owner needs SELECT, for the admin photo library's list()
-- and for remove() (Storage looks the object up before deleting it).
--
-- Undo: drop the new policy and re-create
--   create policy "Public menu images are readable" on storage.objects
--   for select using (bucket_id = 'menu-images');
create policy "Owner lists menu images"
  on storage.objects for select to authenticated
  using (bucket_id = 'menu-images' and public.is_owner());

drop policy if exists "Public menu images are readable" on storage.objects;
