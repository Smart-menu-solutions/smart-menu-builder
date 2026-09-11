insert into menus (slug, name, currency, languages, is_published, categories, translations)
values (
  'translation-test-clean',
  'Translation Test',
  '€',
  '["de","en","el","it","es"]'::jsonb,
  true,
  '[{"name":"Getränke","items":[{"name":"Bier","description":"Frisch gezapft","price":"4.50"},{"name":"Wasser","description":"","price":"2.50"}]}]'::jsonb,
  '{
    "en": {"categories": {"Getränke": {"name": "Beverages"}}, "items": {"Bier": {"name": "Beer", "description": "freshly pulled"}, "Wasser": {"name": "Water", "description": ""}}},
    "el": {"categories": {"Getränke": {"name": "Ποτά"}}, "items": {"Bier": {"name": "Μπίρα", "description": "Φρεσκοχρησιμοποιημένο"}, "Wasser": {"name": "νερό", "description": ""}}},
    "it": {"categories": {"Getränke": {"name": "Bevande"}}, "items": {"Bier": {"name": "birra", "description": "Fresco alla spina"}, "Wasser": {"name": "Acqua", "description": ""}}},
    "es": {"categories": {"Getränke": {"name": "Bebidas"}}, "items": {"Bier": {"name": "Caña", "description": "Recién cogido"}, "Wasser": {"name": "Agua", "description": ""}}}
  }'::jsonb
)
on conflict (slug) do update set
  categories = excluded.categories,
  translations = excluded.translations,
  languages = excluded.languages,
  is_published = excluded.is_published;
