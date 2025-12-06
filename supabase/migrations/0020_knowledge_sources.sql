create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('url', 'pdf', 'youtube')),
  title text,
  source text not null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists knowledge_sources_created_idx
  on public.knowledge_sources (created_at desc);

alter table public.knowledge_sources enable row level security;

drop policy if exists "Service role manages knowledge sources" on public.knowledge_sources;
create policy "Service role manages knowledge sources"
  on public.knowledge_sources
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users insert knowledge sources" on public.knowledge_sources;
create policy "Users insert knowledge sources"
  on public.knowledge_sources
  for insert
  with check (auth.role() = 'service_role' or submitted_by = auth.uid());

drop policy if exists "Users read their knowledge sources" on public.knowledge_sources;
create policy "Users read their knowledge sources"
  on public.knowledge_sources
  for select
  using (auth.role() = 'service_role' or submitted_by = auth.uid());
