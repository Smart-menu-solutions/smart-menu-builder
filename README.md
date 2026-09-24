# Smart Menu Builder

Digital QR Menu Management System

## Features

- Restaurant Management
- QR Codes
- Digital Menus
- Gallery
- WhatsApp Integration
- Google Maps
- Multilanguage Support

Created by Smart Menu Solutions

## Local preview

From this folder, run:

```powershell
.\start-local-preview.ps1
```

Then open `http://localhost:8000/`. The menu preview is available at
`http://localhost:8000/menu.html?client=taverna-athens`.

## Private builder access

The public menus can remain on GitHub Pages, while `admin.html` is protected by
Supabase Authentication and TOTP MFA. Create your single owner account in
Supabase under **Authentication → Users → Add user**, then enroll an
Authenticator app for that account. The browser only contains the Supabase
publishable key; never put a secret or service-role key in the repository.

## Installable app & offline menu (PWA)

`menu.html`, `admin.html` and `login.html` register `sw.js` via
`data/assets/js/pwa.js`. Guests can add a restaurant's menu to their home
screen (the app is named after the restaurant) and the menu they last opened
still works without internet. Everything is network-first, so online nothing
changes; orders, staff views, login and admin data are never cached. After
changing `sw.js`, visitors get a "new version" banner.

## Cron secret

`check-subscriptions` and `send-weekly-report` only run when called with the
`x-cron-secret` header (see `supabase/migrations/0021_cron_secret.sql`). The
same value must exist as the `CRON_SECRET` function secret and as the
`cron_secret` entry in Supabase Vault. It is never stored in this repository.
