-- Track translation usage and credit consumption for auditing and pricing.

create table if not exists public.translation_usage_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  source_language text not null references public.languages (code),
  target_language text not null references public.languages (code),
  usage_type text not null default 'translation' check (usage_type in ('translation', 'cache', 'identity')),
  model_version text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  credits_charged numeric(10,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.translation_usage_logs is 'Records translation API usage, token counts, and credits charged per message.';

create index if not exists translation_usage_logs_user_created_idx
  on public.translation_usage_logs (user_id, created_at desc);

create index if not exists translation_usage_logs_message_idx
  on public.translation_usage_logs (message_id);

alter table public.translation_usage_logs enable row level security;

drop policy if exists "Service role manages translation usage logs" on public.translation_usage_logs;

create policy "Service role manages translation usage logs"
  on public.translation_usage_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
