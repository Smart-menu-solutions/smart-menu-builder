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
