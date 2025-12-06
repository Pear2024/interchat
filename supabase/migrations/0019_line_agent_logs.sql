create table if not exists public.line_agent_logs (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists line_agent_logs_user_created_idx
  on public.line_agent_logs (line_user_id, created_at desc);

alter table public.line_agent_logs enable row level security;

drop policy if exists "Service role manages LINE agent logs" on public.line_agent_logs;

create policy "Service role manages LINE agent logs"
  on public.line_agent_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
