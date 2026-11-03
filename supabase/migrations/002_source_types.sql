alter table public.sources
  alter column storage_path drop not null,
  add column kind text not null default 'pdf',
  add column content text,
  add column original_url text,
  add constraint source_payload check (
    (kind = 'pdf' and storage_path is not null and content is null and original_url is null)
    or (kind = 'text' and storage_path is null and content is not null and original_url is null)
    or (kind = 'web' and storage_path is null and content is not null and original_url is not null)
  );
