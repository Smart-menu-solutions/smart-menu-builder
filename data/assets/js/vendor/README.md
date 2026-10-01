Third-party libraries served from this repo instead of a CDN, so a compromised
CDN or npm release can't run code inside the admin/login pages (where the
owner's Supabase session lives). Exact copies of:

- supabase.js       @supabase/supabase-js 2.117.2  dist/umd/supabase.js
- pdf.min.js        pdf.js 3.11.174 (cdnjs)        - its worker still loads from cdnjs, pinned in admin.js
- tesseract.min.js  tesseract.js 5.1.1              - worker/core/language data load from jsDelivr (worker context only)
- qrcode.js         qrcode-generator 1.5.2 (Kazuhiko Arase, MIT) - draws every QR code in the admin

To update: download the new exact version, replace the file, bump the ?v= in
every page that loads it (admin, login, setup, leads, menu.js, staff.js; qrcode.js only admin).
