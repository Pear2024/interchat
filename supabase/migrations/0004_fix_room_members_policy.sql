-- Replace room_members RLS policies to avoid recursive self-lookups.

drop policy if exists "Members can view their memberships" on public.room_members;
drop policy if exists "Owners manage memberships" on public.room_members;
drop policy if exists "Users join rooms as themselves" on public.room_members;

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

create policy "Users join rooms as themselves"
  on public.room_members
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );
