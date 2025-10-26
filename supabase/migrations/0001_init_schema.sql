-- Enable extensions required across the schema.
create extension if not exists "pgcrypto";

-- ============================================================================
-- Reference data
-- ============================================================================

create table if not exists public.languages (
  code text primary key,
  english_name text not null,
  native_name text not null,
  hello_example text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.languages is 'Reference list of supported languages and greetings.';

-- ============================================================================
-- Core identity
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text references public.languages (code),
  timezone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz
);

comment on table public.profiles is 'User profile metadata keyed to Supabase auth.';

create index if not exists profiles_preferred_language_idx
  on public.profiles (preferred_language);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are self readable" on public.profiles;

create policy "Profiles are self readable"
  on public.profiles
  for select
  using (auth.uid() = id or auth.role() = 'service_role');

drop policy if exists "Profiles are self updatable" on public.profiles;

create policy "Profiles are self updatable"
  on public.profiles
  for update
  using (auth.uid() = id or auth.role() = 'service_role')
  with check (auth.uid() = id or auth.role() = 'service_role');

drop policy if exists "Profiles are self insertable" on public.profiles;

create policy "Profiles are self insertable"
  on public.profiles
  for insert
  with check (auth.uid() = id or auth.role() = 'service_role');

-- ============================================================================
-- Rooms & membership
-- ============================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  description text,
  room_type text not null default 'group' check (room_type in ('direct', 'group', 'broadcast')),
  default_language text references public.languages (code),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

comment on table public.rooms is 'Conversation spaces (direct, group, broadcast).';

create index if not exists rooms_created_by_idx
  on public.rooms (created_by, created_at desc);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  notifications text not null default 'all' check (notifications in ('all', 'mentions', 'mute')),
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_at timestamptz,
  unique (room_id, user_id)
);

comment on table public.room_members is 'Membership list for rooms with per-user settings.';

create index if not exists room_members_user_idx
  on public.room_members (user_id);

alter table public.room_members enable row level security;

drop policy if exists "Members can view their memberships" on public.room_members;

create policy "Members can view their memberships"
  on public.room_members
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or exists (
      select 1
      from public.rooms r
      where r.id = room_members.room_id
        and r.created_by = auth.uid()
    )
  );

drop policy if exists "Owners manage memberships" on public.room_members;

create policy "Owners manage memberships"
  on public.room_members
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.rooms r
      where r.id = room_members.room_id
        and r.created_by = auth.uid()
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.rooms r
      where r.id = room_members.room_id
        and r.created_by = auth.uid()
    )
  );

drop policy if exists "Users join rooms as themselves" on public.room_members;

create policy "Users join rooms as themselves"
  on public.room_members
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );


alter table public.rooms enable row level security;

drop policy if exists "Room members can read rooms" on public.rooms;

create policy "Room members can read rooms"
  on public.rooms
  for select
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = rooms.id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Room creators manage rooms" on public.rooms;

create policy "Room creators manage rooms"
  on public.rooms
  for update
  using (auth.uid() = created_by or auth.role() = 'service_role')
  with check (auth.uid() = created_by or auth.role() = 'service_role');

drop policy if exists "Room creators delete rooms" on public.rooms;

create policy "Room creators delete rooms"
  on public.rooms
  for delete
  using (auth.uid() = created_by or auth.role() = 'service_role');

drop policy if exists "Room creators insert rooms" on public.rooms;

create policy "Room creators insert rooms"
  on public.rooms
  for insert
  with check (auth.uid() = created_by or auth.role() = 'service_role');

-- ============================================================================
-- Messaging
-- ============================================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  original_language text references public.languages (code),
  detected_language text references public.languages (code),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '48 hours'
);

comment on table public.messages is 'Messages authored within rooms.';

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Room members read messages" on public.messages;

create policy "Room members read messages"
  on public.messages
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = messages.room_id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Members post messages" on public.messages;

create policy "Members post messages"
  on public.messages
  for insert
  with check (
    auth.role() = 'service_role'
    or (
      author_id = auth.uid()
      and exists (
        select 1
        from public.room_members rm
        where rm.room_id = messages.room_id
          and rm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Authors manage their messages" on public.messages;

create policy "Authors manage their messages"
  on public.messages
  for update
  using (
    auth.role() = 'service_role'
    or author_id = auth.uid()
  )
  with check (
    auth.role() = 'service_role'
    or author_id = auth.uid()
  );

drop policy if exists "Authors delete their messages" on public.messages;

create policy "Authors delete their messages"
  on public.messages
  for delete
  using (
    auth.role() = 'service_role'
    or author_id = auth.uid()
  );

create table if not exists public.message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  target_language text not null references public.languages (code),
  translated_text text not null,
  model_version text,
  quality_score numeric(4,2),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id)
);

create unique index if not exists message_translations_unique
  on public.message_translations (message_id, target_language);

alter table public.message_translations enable row level security;

drop policy if exists "Members read translations" on public.message_translations;

create policy "Members read translations"
  on public.message_translations
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_translations.message_id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Service role writes translations" on public.message_translations;

create policy "Service role writes translations"
  on public.message_translations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  size bigint not null check (size >= 0),
  mime_type text,
  checksum text,
  created_by uuid references public.profiles (id),
  room_id uuid references public.rooms (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '48 hours'
);

create unique index if not exists files_bucket_path_idx
  on public.files (bucket, path);

alter table public.files enable row level security;

drop policy if exists "File owners and room members read files" on public.files;

create policy "File owners and room members read files"
  on public.files
  for select
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
    or (
      room_id is not null
      and exists (
        select 1
        from public.room_members rm
        where rm.room_id = files.room_id
          and rm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users upload their own files" on public.files;

create policy "Users upload their own files"
  on public.files
  for insert
  with check (
    auth.role() = 'service_role'
    or created_by = auth.uid()
  );

drop policy if exists "File owners delete files" on public.files;

create policy "File owners delete files"
  on public.files
  for delete
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
  );

create table if not exists public.message_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  file_id uuid not null references public.files (id) on delete cascade,
  caption text
);

create unique index if not exists message_files_unique
  on public.message_files (message_id, file_id);

alter table public.message_files enable row level security;

drop policy if exists "Members read message files" on public.message_files;

create policy "Members read message files"
  on public.message_files
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_files.message_id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Service role manages message files" on public.message_files;

create policy "Service role manages message files"
  on public.message_files
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id, emoji)
);

alter table public.reactions enable row level security;

drop policy if exists "Members read reactions" on public.reactions;

create policy "Members read reactions"
  on public.reactions
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = reactions.message_id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Members react to messages" on public.reactions;

create policy "Members react to messages"
  on public.reactions
  for insert
  with check (
    auth.role() = 'service_role'
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.messages m
        join public.room_members rm on rm.room_id = m.room_id
        where m.id = reactions.message_id
          and rm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users remove their reactions" on public.reactions;

create policy "Users remove their reactions"
  on public.reactions
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

-- ============================================================================
-- Trust & safety
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reported_message_id uuid not null references public.messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  handled_by uuid references public.profiles (id),
  handled_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Reporters view own reports" on public.reports;

create policy "Reporters view own reports"
  on public.reports
  for select
  using (
    auth.role() = 'service_role'
    or reporter_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner')
    )
  );

drop policy if exists "Members can create reports" on public.reports;

create policy "Members can create reports"
  on public.reports
  for insert
  with check (
    auth.role() = 'service_role'
    or reporter_id = auth.uid()
  );

drop policy if exists "Moderators handle reports" on public.reports;

create policy "Moderators handle reports"
  on public.reports
  for update
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner')
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner')
    )
  );

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.audit_logs is 'Immutable audit trail for admin oversight.';

alter table public.audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.audit_logs;

create policy "Admins read audit logs"
  on public.audit_logs
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role = 'owner'
    )
  );

drop policy if exists "Service role writes audit logs" on public.audit_logs;

create policy "Service role writes audit logs"
  on public.audit_logs
  for insert
  with check (auth.role() = 'service_role');

-- ============================================================================
-- Billing & analytics
-- ============================================================================

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  customer_id text not null,
  plan_tier text not null default 'free',
  seats integer not null default 1 check (seats >= 0),
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists billing_customers_provider_key
  on public.billing_customers (provider, customer_id);

alter table public.billing_customers enable row level security;

drop policy if exists "Owners manage billing" on public.billing_customers;

create policy "Owners manage billing"
  on public.billing_customers
  for all
  using (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
  )
  with check (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
  );

create table if not exists public.usage_metrics (
  id bigserial primary key,
  profile_id uuid references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete cascade,
  metric_date date not null,
  messages_count integer not null default 0,
  translations_count integer not null default 0,
  storage_bytes bigint not null default 0,
  cost_usd numeric(12,4) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists usage_metrics_unique_idx
  on public.usage_metrics (
    coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(room_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric_date
  );

alter table public.usage_metrics enable row level security;

drop policy if exists "Owners read usage metrics" on public.usage_metrics;

create policy "Owners read usage metrics"
  on public.usage_metrics
  for select
  using (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
  );

drop policy if exists "Service role writes usage metrics" on public.usage_metrics;

create policy "Service role writes usage metrics"
  on public.usage_metrics
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role updates usage metrics" on public.usage_metrics;

create policy "Service role updates usage metrics"
  on public.usage_metrics
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================================
-- Grants
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select on public.languages to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.room_members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select on public.message_translations to authenticated;
grant select, insert, update, delete on public.files to authenticated;
grant select on public.message_files to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.billing_customers to authenticated;
grant select on public.usage_metrics to authenticated;
