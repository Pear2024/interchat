create table if not exists public.line_agent_contacts (
  line_user_id text primary key,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_message text
);

alter table public.line_agent_contacts enable row level security;

drop policy if exists "Service role manages line contacts" on public.line_agent_contacts;
create policy "Service role manages line contacts"
  on public.line_agent_contacts
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
