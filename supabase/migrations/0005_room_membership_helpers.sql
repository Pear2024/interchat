-- Helper functions to check room membership/ownership without recursive RLS.

create or replace function public.is_room_member(target_room uuid, target_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = target_room
        and rm.user_id = target_user
    ),
    false
  );
$$;

create or replace function public.is_room_owner(target_room uuid, target_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.rooms r
      where r.id = target_room
        and r.created_by = target_user
    ),
    false
  );
$$;

grant execute on function public.is_room_member(uuid, uuid) to authenticated;
grant execute on function public.is_room_owner(uuid, uuid) to authenticated;

-- Rework policies to use helper functions instead of direct room_members joins.

drop policy if exists "Room members can read rooms" on public.rooms;
drop policy if exists "Room creators manage rooms" on public.rooms;
drop policy if exists "Room creators delete rooms" on public.rooms;
drop policy if exists "Room creators insert rooms" on public.rooms;

create policy "Room members can read rooms"
  on public.rooms
  for select
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
    or public.is_room_member(rooms.id)
  );

create policy "Room creators manage rooms"
  on public.rooms
  for update
  using (auth.uid() = created_by or auth.role() = 'service_role')
  with check (auth.uid() = created_by or auth.role() = 'service_role');

create policy "Room creators delete rooms"
  on public.rooms
  for delete
  using (auth.uid() = created_by or auth.role() = 'service_role');

create policy "Room creators insert rooms"
  on public.rooms
  for insert
  with check (auth.uid() = created_by or auth.role() = 'service_role');

drop policy if exists "Members can view their memberships" on public.room_members;
drop policy if exists "Owners manage memberships" on public.room_members;
drop policy if exists "Users join rooms as themselves" on public.room_members;

create policy "Members can view their memberships"
  on public.room_members
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or public.is_room_owner(room_members.room_id)
  );

create policy "Owners manage memberships"
  on public.room_members
  for all
  using (
    auth.role() = 'service_role'
    or public.is_room_owner(room_members.room_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_room_owner(room_members.room_id)
  );

create policy "Users join rooms as themselves"
  on public.room_members
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

drop policy if exists "Room members read messages" on public.messages;
drop policy if exists "Members post messages" on public.messages;

create policy "Room members read messages"
  on public.messages
  for select
  using (
    auth.role() = 'service_role'
    or public.is_room_member(messages.room_id)
  );

create policy "Members post messages"
  on public.messages
  for insert
  with check (
    auth.role() = 'service_role'
    or (
      author_id = auth.uid()
      and public.is_room_member(messages.room_id)
    )
  );

drop policy if exists "File owners and room members read files" on public.files;

create policy "File owners and room members read files"
  on public.files
  for select
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
    or (
      room_id is not null
      and public.is_room_member(files.room_id)
    )
  );

drop policy if exists "Members read message files" on public.message_files;

create policy "Members read message files"
  on public.message_files
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      where m.id = message_files.message_id
        and public.is_room_member(m.room_id)
    )
  );

drop policy if exists "Members read reactions" on public.reactions;

create policy "Members read reactions"
  on public.reactions
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      where m.id = reactions.message_id
        and public.is_room_member(m.room_id)
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
        where m.id = reactions.message_id
          and public.is_room_member(m.room_id)
      )
    )
  );

drop policy if exists "Reporters view own reports" on public.reports;

create policy "Reporters view own reports"
  on public.reports
  for select
  using (
    auth.role() = 'service_role'
    or reporter_id = auth.uid()
    or exists (
      select 1
      from public.rooms r
      where r.created_by = auth.uid()
    )
  );

drop policy if exists "Members read translations" on public.message_translations;

create policy "Members read translations"
  on public.message_translations
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.messages m
      where m.id = message_translations.message_id
        and public.is_room_member(m.room_id)
    )
  );
