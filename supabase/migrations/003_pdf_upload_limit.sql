update storage.buckets set file_size_limit = 10485760 where id = 'documents';

create policy document_stage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'pending'
    and array_length(storage.foldername(name), 1) = 3
    and exists (
      select 1 from public.notebooks
      where id::text = (storage.foldername(storage.objects.name))[2]
        and user_id = (select auth.uid())
    )
  );
