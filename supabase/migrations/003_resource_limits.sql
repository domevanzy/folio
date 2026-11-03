begin;

-- Rejected requests must not keep incrementing the counter.
create or replace function public.consume_rate_limit(p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  ceiling int := case p_kind
    when 'chat' then 30 when 'upload' then 8
    when 'summary' then 8 when 'notebook' then 30 else 0 end;
  current_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null or ceiling = 0 then return false; end if;
  insert into public.request_limits as r values (auth.uid(), p_kind, current_window, 1)
  on conflict (user_id, kind) do update
    set hits = case when r.window_start = current_window then r.hits + 1 else 1 end,
        window_start = current_window
    where r.window_start < current_window
       or (r.window_start = current_window and r.hits < ceiling);
  return found;
end;
$$;

-- One active model job and one import per account. The opaque token prevents
-- other requests from releasing a slot they did not acquire.
create table public.request_slots (
  user_id uuid references auth.users on delete cascade,
  kind text not null check (kind in ('model', 'upload')),
  token uuid not null,
  expires_at timestamptz not null,
  primary key (user_id, kind)
);
alter table public.request_slots enable row level security;
revoke all on public.request_slots from public, anon, authenticated;

create function public.acquire_request_slot(p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare slot_token uuid;
begin
  if auth.uid() is null or p_kind is null or p_kind not in ('model', 'upload') then
    return null;
  end if;
  insert into public.request_slots as s
    values (auth.uid(), p_kind, gen_random_uuid(), clock_timestamp() + interval '310 seconds')
  on conflict (user_id, kind) do update
    set token = excluded.token, expires_at = excluded.expires_at
    where s.expires_at <= clock_timestamp()
  returning token into slot_token;
  return slot_token;
end;
$$;

create function public.release_request_slot(p_kind text, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.request_slots
  where user_id = auth.uid() and kind = p_kind and token = p_token;
$$;
revoke all on function public.acquire_request_slot(text), public.release_request_slot(text, uuid) from public, anon;
grant execute on function public.acquire_request_slot(text), public.release_request_slot(text, uuid) to authenticated;

create index on public.sources(user_id);
create index on public.document_chunks(user_id);
create index on public.messages(user_id);

-- Count existing rows too. Serialize inserts for the same account and table,
-- including multi-row inserts and writes made directly via PostgREST.
create function public.enforce_account_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid;
  used bigint;
  ceiling int := tg_argv[0]::int;
begin
  if tg_table_schema = 'storage' then
    if new.bucket_id is distinct from 'documents' then return new; end if;
    account_id := split_part(new.name, '/', 1)::uuid;
  else
    account_id := new.user_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(tg_relid::text || ':' || account_id::text, 0));
  if tg_table_schema = 'storage' then
    select count(*) into used from storage.objects
      where bucket_id = 'documents' and name like account_id::text || '/%';
  else
    execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
      into used using account_id;
  end if;
  if used > ceiling then
    raise exception using errcode = 'PT429', message = 'Kontingent für gespeicherte Inhalte erreicht.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_account_quota() from public, anon, authenticated;

-- AFTER INSERT counts rows actually inserted, including all rows in the batch,
-- and does not fire for the update branch of an upsert.
create trigger notebook_quota after insert on public.notebooks
for each row execute function public.enforce_account_quota('100');
create trigger source_quota after insert on public.sources
for each row execute function public.enforce_account_quota('300');
create trigger chunk_quota after insert on public.document_chunks
for each row execute function public.enforce_account_quota('24000');
create trigger message_quota after insert on public.messages
for each row execute function public.enforce_account_quota('10000');
create trigger document_quota after insert on storage.objects
for each row execute function public.enforce_account_quota('300');

alter table public.sources add constraint source_payload_size
  check (length(content) <= 300000 and length(original_url) <= 2048
    and length(error) <= 2000) not valid;
alter table public.messages add constraint message_citations_size
  check (octet_length(citations::text) <= 65536) not valid;

commit;
