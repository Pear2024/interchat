-- Allow anon role to read demo data for public showcase.

alter policy "Profiles are self readable" on public.profiles
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or auth.uid() = id
  );

alter policy "Room members read messages" on public.messages
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or public.is_room_member(messages.room_id)
  );

alter policy "Members read translations" on public.message_translations
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or exists (
      select 1
      from public.messages m
      where m.id = message_translations.message_id
        and public.is_room_member(m.room_id)
    )
  );

alter policy "Members read message files" on public.message_files
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or exists (
      select 1
      from public.messages m
      where m.id = message_files.message_id
        and public.is_room_member(m.room_id)
    )
  );

alter policy "Members read reactions" on public.reactions
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or exists (
      select 1
      from public.messages m
      where m.id = reactions.message_id
        and public.is_room_member(m.room_id)
    )
  );

alter policy "Members can view their memberships" on public.room_members
  using (
    auth.role() = 'service_role'
    or auth.role() = 'anon'
    or user_id = auth.uid()
    or public.is_room_owner(room_members.room_id)
  );
