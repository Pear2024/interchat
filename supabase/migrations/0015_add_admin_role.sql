-- Add the new admin role to room membership constraints and migrate existing data.

alter table public.room_members
  drop constraint if exists room_members_role_check;

alter table public.room_members
  add constraint room_members_role_check
  check (role in ('member', 'moderator', 'owner', 'admin'));

-- Promote existing creators to admins so they retain advanced permissions.
update public.room_members rm
set role = 'admin'
from public.rooms r
where rm.room_id = r.id
  and rm.user_id = r.created_by
  and rm.role = 'owner';

-- Extend moderation policies to include admins.
alter policy "Reporters view own reports" on public.reports
  using (
    auth.role() = 'service_role'
    or reporter_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner', 'admin')
    )
  );

alter policy "Moderators handle reports" on public.reports
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner', 'admin')
    )
  );

alter policy "Moderators handle reports" on public.reports
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.room_members rm
      where rm.user_id = auth.uid()
        and rm.role in ('moderator', 'owner', 'admin')
    )
  );
