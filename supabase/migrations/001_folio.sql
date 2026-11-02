begin;
create extension if not exists vector with schema extensions;
create table public.notebooks(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,title text not null check(length(title) between 1 and 120),created_at timestamptz not null default now(),unique(id,user_id));
create table public.sources(id uuid primary key default gen_random_uuid(),notebook_id uuid not null,user_id uuid not null, name text not null check(length(name) between 1 and 180),storage_path text not null unique,status text not null default 'processing' check(status in ('processing','ready','failed')),page_count int not null default 0,error text,created_at timestamptz not null default now(),foreign key(notebook_id,user_id) references public.notebooks(id,user_id) on delete cascade,unique(id,notebook_id,user_id));
create table public.document_chunks(id uuid primary key default gen_random_uuid(),notebook_id uuid not null,source_id uuid not null,user_id uuid not null,page_number int not null check(page_number>0),chunk_index int not null check(chunk_index>=0),content text not null check(length(content)<=6000),embedding extensions.vector(768) not null,foreign key(source_id,notebook_id,user_id) references public.sources(id,notebook_id,user_id) on delete cascade,unique(source_id,chunk_index));
create table public.conversations(id uuid primary key default gen_random_uuid(),notebook_id uuid not null unique,user_id uuid not null,created_at timestamptz not null default now(),foreign key(notebook_id,user_id) references public.notebooks(id,user_id) on delete cascade,unique(id,notebook_id,user_id));
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null,notebook_id uuid not null,user_id uuid not null,role text not null check(role in ('user','assistant')),content text not null check(length(content)<=60000),citations jsonb not null default '[]',created_at timestamptz not null default now(),foreign key(conversation_id,notebook_id,user_id) references public.conversations(id,notebook_id,user_id) on delete cascade);
create index on public.notebooks(user_id);
create index on public.sources(notebook_id,user_id);
create index on public.document_chunks(notebook_id,source_id);
create index on public.messages(conversation_id,created_at);
create index on public.document_chunks using hnsw(embedding extensions.vector_cosine_ops);
alter table public.notebooks enable row level security;
alter table public.sources enable row level security;
alter table public.document_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy own_notebooks on public.notebooks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_sources on public.sources for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_chunks on public.document_chunks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_conversations on public.conversations for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_messages on public.messages for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.notebooks,public.sources,public.document_chunks,public.conversations,public.messages to authenticated;

-- Invoker: RLS remains active, including when called directly through PostgREST.
create function public.match_document_chunks(p_notebook_id uuid,p_source_ids uuid[],p_embedding extensions.vector(768),p_limit int default 10,p_threshold float default 0.3)
returns table(id uuid,source_id uuid,page_number int,chunk_index int,content text,similarity float)
language sql stable security invoker set search_path='' as $$
select c.id,c.source_id,c.page_number,c.chunk_index,c.content,1-(c.embedding operator(extensions.<=>) p_embedding) as similarity
from public.document_chunks c join public.sources s on s.id=c.source_id
where c.user_id=auth.uid() and c.notebook_id=p_notebook_id and c.source_id=any(p_source_ids) and s.status='ready'
and 1-(c.embedding operator(extensions.<=>) p_embedding)>=greatest(p_threshold,0.15)
order by c.embedding operator(extensions.<=>) p_embedding limit least(greatest(p_limit,1),20);
$$;
revoke all on function public.match_document_chunks from public,anon;
grant execute on function public.match_document_chunks to authenticated;

-- Distributed, atomic limits: never rely on a per-process in-memory map.
create table public.request_limits(user_id uuid references auth.users on delete cascade,kind text not null,window_start timestamptz not null,hits int not null,primary key(user_id,kind));
alter table public.request_limits enable row level security;
revoke all on public.request_limits from anon,authenticated;
create function public.consume_rate_limit(p_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare ceiling int; current_hits int; current_window timestamptz;
begin
if auth.uid() is null then return false; end if;
ceiling:=case p_kind when 'chat' then 30 when 'upload' then 8 when 'summary' then 8 when 'notebook' then 30 else 0 end;
if ceiling=0 then return false; end if;
current_window:=date_trunc('hour',now());
insert into public.request_limits as r values(auth.uid(),p_kind,current_window,1)
on conflict(user_id,kind) do update set hits=case when r.window_start=current_window then r.hits+1 else 1 end,window_start=current_window returning hits into current_hits;
return current_hits<=ceiling;
end;$$;
revoke all on function public.consume_rate_limit from public,anon;
grant execute on function public.consume_rate_limit to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,4194304,array['application/pdf']);
create policy document_select on storage.objects for select to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy document_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.sources s where s.storage_path=storage.objects.name and s.user_id=auth.uid()));
create policy document_delete on storage.objects for delete to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
