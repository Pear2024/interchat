alter table public.rooms
add column if not exists is_locked boolean not null default false;

comment on column public.rooms.is_locked is 'When true, new members cannot auto-join the room.';
