-- Prevent deletion or membership removal for the demo room.

drop policy if exists "Room creators delete rooms" on public.rooms;

create policy "Room creators delete rooms"
  on public.rooms
  for delete
  using (
    auth.role() = 'service_role'
    or (auth.uid() = created_by and slug <> 'global-collab')
  );

drop policy if exists "Members leave rooms" on public.room_members;
create policy "Members leave rooms"
  on public.room_members
  for delete
  using (
    auth.role() = 'service_role'
    or (user_id = auth.uid() and not exists (
      select 1
      from public.rooms r
      where r.id = room_members.room_id
        and r.slug = 'global-collab'
    ))
  );
