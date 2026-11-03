with expected_tables(name, policy) as (
  values
    ('notebooks', 'own_notebooks'),
    ('sources', 'own_sources'),
    ('document_chunks', 'own_chunks'),
    ('conversations', 'own_conversations'),
    ('messages', 'own_messages'),
    ('request_limits', null),
    ('request_slots', null)
),
expected_functions(signature, security_definer) as (
  values
    ('public.match_document_chunks(uuid,uuid[],extensions.vector,integer,double precision)', false),
    ('public.consume_rate_limit(text)', true),
    ('public.acquire_request_slot(text)', true),
    ('public.release_request_slot(text,uuid)', true)
)
select 'public.' || expected.name as name,
       coalesce(c.relkind = 'r' and c.relrowsecurity and (
         expected.policy is null or exists (
           select 1 from pg_policy p
           where p.polrelid = c.oid and p.polname = expected.policy
         )
       ), false) as ok
from expected_tables expected
left join pg_class c on c.oid = to_regclass('public.' || expected.name)
union all
select 'extensions.vector / document_chunks.embedding',
       exists (
         select 1 from pg_attribute a
         where a.attrelid = to_regclass('public.document_chunks')
           and a.attname = 'embedding' and not a.attisdropped
           and a.atttypid = to_regtype('extensions.vector') and a.atttypmod = 768
       )
union all
select expected.signature,
       coalesce(p.prosecdef = expected.security_definer
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')
         and not has_function_privilege('anon', p.oid, 'EXECUTE'), false)
from expected_functions expected
left join pg_proc p on p.oid = case
  when expected.security_definer or to_regtype('extensions.vector') is not null
  then to_regprocedure(expected.signature)
end
union all
select 'storage bucket documents',
       exists (
         select 1 from storage.buckets
         where id = 'documents' and not public and file_size_limit = 4194304
           and allowed_mime_types = array['application/pdf']
       )
union all
select 'storage policy ' || expected.name,
       exists (
         select 1 from pg_policy p
         where p.polrelid = to_regclass('storage.objects') and p.polname = expected.name
       )
from (values ('document_select'), ('document_insert'), ('document_delete')) expected(name);
