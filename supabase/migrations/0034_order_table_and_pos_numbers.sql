-- Smart ServiceHub customers type their table numbers ("1-8, 12, Terrasse 1")
-- and, new, their till numbers per dish ("Rindersuppe 350") on the upload
-- page. Until now the table numbers only went into the internal "Dateien
-- eingegangen" email - when that email failed on 2026-10-05 they were lost.
-- Both are kept on the order now (free text, written by order-upload with the
-- service role) and shown in the builder, which can turn them into tables and
-- dish till numbers. Readable through the existing "Owner reads orders" policy.
alter table public.orders add column if not exists table_numbers text;
alter table public.orders add column if not exists pos_numbers text;
