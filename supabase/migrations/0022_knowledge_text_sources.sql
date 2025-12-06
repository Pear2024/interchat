alter table public.knowledge_sources
  add column if not exists raw_text text;

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_type_check;

alter table public.knowledge_sources
  add constraint knowledge_sources_type_check
  check (type in ('url', 'pdf', 'youtube', 'text'));
