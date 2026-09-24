-- Both buckets accepted any file type. menu-pdfs is writable by anyone (the
-- public order/renewal forms), so without a type limit it could be used to
-- park arbitrary files on our storage. Limits match what the site sends:
-- order-form.js/renewal-form.js upload PDFs and the photo-add-on ZIP,
-- admin.js uploads images for the menus.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'application/zip', 'application/x-zip-compressed']
where id = 'menu-pdfs';

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
where id = 'menu-images';
