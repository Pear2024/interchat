alter table public.room_members
  add column if not exists last_seen_message_at timestamptz default timezone('utc', now());

update public.room_members
set last_seen_message_at = coalesce(last_seen_message_at, joined_at);

create index if not exists room_members_last_seen_idx
  on public.room_members (room_id, last_seen_message_at desc);
