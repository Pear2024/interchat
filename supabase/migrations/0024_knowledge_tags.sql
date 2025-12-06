alter table public.knowledge_sources
  add column if not exists tags text[];

create index if not exists knowledge_sources_tags_idx
  on public.knowledge_sources using gin (tags);
