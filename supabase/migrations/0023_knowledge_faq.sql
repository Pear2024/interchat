create table if not exists public.knowledge_faq (
  id uuid primary key default gen_random_uuid(),
  question_hash text not null unique,
  question_raw text not null,
  answer text not null,
  model text,
  usage_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz not null default timezone('utc', now())
);

create index if not exists knowledge_faq_last_used_idx
  on public.knowledge_faq (last_used_at desc);

alter table public.knowledge_faq enable row level security;

drop policy if exists "Service role manages knowledge faq" on public.knowledge_faq;
create policy "Service role manages knowledge faq"
  on public.knowledge_faq
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
