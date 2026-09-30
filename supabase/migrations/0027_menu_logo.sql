-- Customer logo on the guest menu. menu.js already renders
-- client.logo_url in the menu header (logoMarkup) and menu.css already styles
-- .menu-logo; only the column and the builder field were missing. Public
-- image URL from the menu-images bucket, same as header_background_url.
alter table public.menus add column if not exists logo_url text;
