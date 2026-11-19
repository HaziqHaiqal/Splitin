insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 4000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
