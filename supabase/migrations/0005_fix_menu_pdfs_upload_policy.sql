-- The order form's Supabase client shares localStorage with the admin
-- dashboard on the same origin, so if the owner happens to be logged in
-- while also testing the order form in another tab, the upload request
-- carries an authenticated session instead of an anonymous one. The
-- original policy only covered anon, so that request was rejected by RLS.
drop policy if exists "Anyone can upload an order PDF" on storage.objects;

create policy "Anyone can upload an order PDF"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'menu-pdfs');
