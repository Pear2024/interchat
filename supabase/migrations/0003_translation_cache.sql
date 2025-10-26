-- Translation cache table to reuse repeated translations across messages.

create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  source_text text not null,
  source_language text not null references public.languages (code),
  target_language text not null references public.languages (code),
  model_version text,
  translated_text text not null,
  quality_score numeric(4,2),
  context_signature text,
  usage_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz not null default timezone('utc', now())
);

comment on table public.translation_cache is 'Normalized cache of translated phrases for reuse across messages.';
comment on column public.translation_cache.source_hash is 'Stable hash of (source_language, normalized_text, context_signature).';

create unique index if not exists translation_cache_unique_idx
  on public.translation_cache (source_hash, source_language, target_language, coalesce(context_signature, ''));

create index if not exists translation_cache_last_used_idx
  on public.translation_cache (last_used_at desc);

alter table public.translation_cache enable row level security;

drop policy if exists "Clients read translation cache" on public.translation_cache;

create policy "Clients read translation cache"
  on public.translation_cache
  for select
  using (auth.uid() is not null or auth.role() = 'service_role');

drop policy if exists "Service role manages translation cache" on public.translation_cache;

create policy "Service role manages translation cache"
  on public.translation_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on public.translation_cache to authenticated;
