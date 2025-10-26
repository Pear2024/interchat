-- Align profiles table with existing NextAuth user data and keep them in sync.

alter table public.profiles
  add column if not exists default_input_language text references public.languages (code),
  add column if not exists default_read_language text references public.languages (code);

-- Initial backfill from the NextAuth "User" table.
insert into public.profiles (
  id,
  display_name,
  avatar_url,
  preferred_language,
  default_input_language,
  default_read_language,
  created_at,
  updated_at,
  last_seen_at
)
select
  u.id::uuid,
  coalesce(u."displayName", u.name, split_part(u.email, '@', 1)),
  u.image,
  u."defaultReadLang",
  u."defaultInputLang",
  u."defaultReadLang",
  coalesce(u."createdAt", timezone('utc', now())),
  coalesce(u."updatedAt", timezone('utc', now())),
  null
from public."User" u
on conflict (id) do update
set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  preferred_language = excluded.preferred_language,
  default_input_language = excluded.default_input_language,
  default_read_language = excluded.default_read_language,
  updated_at = excluded.updated_at;

-- Trigger function to keep profiles updated when NextAuth's User table changes.
create or replace function public.sync_profile_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    avatar_url,
    preferred_language,
    default_input_language,
    default_read_language,
    created_at,
    updated_at
  )
  values (
    new.id::uuid,
    coalesce(new."displayName", new.name, split_part(new.email, '@', 1)),
    new.image,
    new."defaultReadLang",
    new."defaultInputLang",
    new."defaultReadLang",
    coalesce(new."createdAt", timezone('utc', now())),
    coalesce(new."updatedAt", timezone('utc', now()))
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        preferred_language = excluded.preferred_language,
        default_input_language = excluded.default_input_language,
        default_read_language = excluded.default_read_language,
        updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_from_user on public."User";

create trigger trg_sync_profile_from_user
after insert or update on public."User"
for each row execute function public.sync_profile_from_user();
