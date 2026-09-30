-- upload.html now also takes an optional customer logo (PNG or JPEG) next to
-- the menu PDF and the photo ZIP. order-upload hands out the signed upload URL
-- for orders/<session id>/logo and checks the file's first bytes itself; the
-- bucket's MIME allow-list (0022) just has to let the two image types in.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg']
where id = 'menu-pdfs';
