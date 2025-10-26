alter table public.rooms
add column if not exists direct_pair_key text unique;

comment on column public.rooms.direct_pair_key is 'Deterministic key for direct message rooms (sorted user ids). Ensure uniqueness to prevent duplicate DMs.';

create unique index if not exists rooms_direct_pair_key_unique
  on public.rooms (direct_pair_key)
  where direct_pair_key is not null;
