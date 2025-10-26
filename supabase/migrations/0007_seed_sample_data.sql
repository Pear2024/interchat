do $$
declare
  owner_user auth.users;
  partner_user auth.users;
  observer_user auth.users;
  owner_profile uuid;
  partner_profile uuid;
  observer_profile uuid;
begin
  -- Ensure demo users exist via admin API so foreign keys remain valid.
  select * into owner_user from auth.users where email = 'owner@interchat.demo';
  if owner_user.id is null then
    owner_user := auth.admin_create_user(
      jsonb_build_object(
        'email', 'owner@interchat.demo',
        'email_confirm', true,
        'password', 'DemoOwner123!',
        'user_metadata', jsonb_build_object('display_name', 'Pear', 'preferred_language', 'th')
      )
    );
  end if;

  select * into partner_user from auth.users where email = 'partner@interchat.demo';
  if partner_user.id is null then
    partner_user := auth.admin_create_user(
      jsonb_build_object(
        'email', 'partner@interchat.demo',
        'email_confirm', true,
        'password', 'DemoPartner123!',
        'user_metadata', jsonb_build_object('display_name', 'Noa Levi', 'preferred_language', 'he')
      )
    );
  end if;

  select * into observer_user from auth.users where email = 'observer@interchat.demo';
  if observer_user.id is null then
    observer_user := auth.admin_create_user(
      jsonb_build_object(
        'email', 'observer@interchat.demo',
        'email_confirm', true,
        'password', 'DemoObserver123!',
        'user_metadata', jsonb_build_object('display_name', 'Interchat Bot', 'preferred_language', 'en')
      )
    );
  end if;

  owner_profile := owner_user.id;
  partner_profile := partner_user.id;
  observer_profile := observer_user.id;

  insert into public.profiles (id, display_name, avatar_url, preferred_language, created_at, updated_at)
  values
    (owner_profile, 'Pear', null, 'th', timezone('utc', now()), timezone('utc', now())),
    (partner_profile, 'Noa Levi', null, 'he', timezone('utc', now()), timezone('utc', now())),
    (observer_profile, 'Interchat Bot', null, 'en', timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do update
  set display_name = excluded.display_name,
      preferred_language = excluded.preferred_language,
      updated_at = excluded.updated_at;

  insert into public.rooms (id, slug, name, description, room_type, default_language, created_by, created_at, updated_at)
  values (
    '11111111-1111-1111-1111-111111111111',
    'global-collab',
    'Global Collaboration Room',
    'Realtime multilingual workspace demo',
    'group',
    'en',
    owner_profile,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      default_language = excluded.default_language,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at;

  insert into public.room_members (room_id, user_id, role, notifications, joined_at)
  values
    ('11111111-1111-1111-1111-111111111111', owner_profile, 'owner', 'all', timezone('utc', now())),
    ('11111111-1111-1111-1111-111111111111', partner_profile, 'member', 'all', timezone('utc', now())),
    ('11111111-1111-1111-1111-111111111111', observer_profile, 'member', 'mentions', timezone('utc', now()))
  on conflict (room_id, user_id) do update
  set role = excluded.role,
      notifications = excluded.notifications,
      joined_at = excluded.joined_at;

  insert into public.messages (id, room_id, author_id, content, original_language, detected_language, metadata, created_at, expires_at)
  values
    ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', partner_profile, 'שלום! מאיפה את?', 'he', 'he', '{}'::jsonb, timezone('utc', now()) - interval '5 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', owner_profile, 'ฉันมาจากอิสราเอล', 'th', 'th', '{}'::jsonb, timezone('utc', now()) - interval '4 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', partner_profile, 'איך קוראים לך?', 'he', 'he', '{}'::jsonb, timezone('utc', now()) - interval '3 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', owner_profile, 'ฉันชื่อ ดาเนียล', 'th', 'th', '{}'::jsonb, timezone('utc', now()) - interval '2 minutes', timezone('utc', now()) + interval '48 hours')
  on conflict (id) do update
  set content = excluded.content,
      original_language = excluded.original_language,
      detected_language = excluded.detected_language,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at;

  insert into public.message_translations (message_id, target_language, translated_text, model_version, quality_score, created_at)
  values
    ('30000000-0000-0000-0000-000000000001', 'en', 'Hello! Where are you from?', 'gpt-4o-mini', 0.94, timezone('utc', now()) - interval '5 minutes'),
    ('30000000-0000-0000-0000-000000000002', 'en', 'I''m from Israel.', 'gpt-4o-mini', 0.92, timezone('utc', now()) - interval '4 minutes'),
    ('30000000-0000-0000-0000-000000000003', 'en', 'What is your name?', 'gpt-4o-mini', 0.95, timezone('utc', now()) - interval '3 minutes'),
    ('30000000-0000-0000-0000-000000000004', 'en', 'My name is Daniyal.', 'gpt-4o-mini', 0.91, timezone('utc', now()) - interval '2 minutes')
  on conflict (message_id, target_language) do update
  set translated_text = excluded.translated_text,
      model_version = excluded.model_version,
      quality_score = excluded.quality_score,
      created_at = excluded.created_at;
end;
$$;
