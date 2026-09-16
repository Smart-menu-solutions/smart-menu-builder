-- The Pictures library in the admin dashboard could upload photos but had
-- no way to delete one, because storage.objects only had select/insert
-- policies for the menu-images bucket -- a delete call was silently
-- rejected by RLS with no matching policy to allow it.
create policy "Authenticated owners delete menu images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images');
