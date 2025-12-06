create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source_id, chunk_index);

alter table public.knowledge_chunks enable row level security;

drop policy if exists "Service role manages knowledge chunks" on public.knowledge_chunks;
create policy "Service role manages knowledge chunks"
  on public.knowledge_chunks
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
