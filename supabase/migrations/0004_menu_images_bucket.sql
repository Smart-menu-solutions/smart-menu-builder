insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "Public menu images are readable"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "Authenticated owners upload menu images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images');
