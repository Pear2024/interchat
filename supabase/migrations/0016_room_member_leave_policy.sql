-- Allow members to leave rooms themselves.

drop policy if exists "Members leave rooms" on public.room_members;

create policy "Members leave rooms"
  on public.room_members
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );
