do $$
declare
  base_instance constant uuid := '00000000-0000-0000-0000-000000000000';
  owner_id uuid;
  partner_id uuid;
  observer_id uuid;
begin
  insert into auth.users (id, instance_id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-0000000000a1',
    base_instance,
    'owner@interchat.demo',
    'authenticated',
    'authenticated',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('display_name', 'Pear', 'preferred_language', 'th'),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = excluded.updated_at;

  insert into auth.users (id, instance_id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-0000000000a2',
    base_instance,
    'partner@interchat.demo',
    'authenticated',
    'authenticated',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('display_name', 'Noa Levi', 'preferred_language', 'he'),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = excluded.updated_at;

  insert into auth.users (id, instance_id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-0000000000a3',
    base_instance,
    'observer@interchat.demo',
    'authenticated',
    'authenticated',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('display_name', 'Interchat Bot', 'preferred_language', 'en'),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = excluded.updated_at;

  owner_id := '00000000-0000-0000-0000-0000000000a1';
  partner_id := '00000000-0000-0000-0000-0000000000a2';
  observer_id := '00000000-0000-0000-0000-0000000000a3';

  insert into public.profiles (id, display_name, preferred_language, created_at, updated_at)
  values
    (owner_id, 'Pear', 'th', timezone('utc', now()), timezone('utc', now())),
    (partner_id, 'Noa Levi', 'he', timezone('utc', now()), timezone('utc', now())),
    (observer_id, 'Interchat Bot', 'en', timezone('utc', now()), timezone('utc', now()))
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
    owner_id,
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
    ('11111111-1111-1111-1111-111111111111', owner_id, 'owner', 'all', timezone('utc', now())),
    ('11111111-1111-1111-1111-111111111111', partner_id, 'member', 'all', timezone('utc', now())),
    ('11111111-1111-1111-1111-111111111111', observer_id, 'member', 'mentions', timezone('utc', now()))
  on conflict (room_id, user_id) do update
  set role = excluded.role,
      notifications = excluded.notifications,
      joined_at = excluded.joined_at;

  insert into public.messages (id, room_id, author_id, content, original_language, detected_language, metadata, created_at, expires_at)
  values
    ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', partner_id, 'שלום! מאיפה את?', 'he', 'he', '{}'::jsonb, timezone('utc', now()) - interval '5 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', owner_id, 'ฉันมาจากอิสราเอล', 'th', 'th', '{}'::jsonb, timezone('utc', now()) - interval '4 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', partner_id, 'איך קוראים לך?', 'he', 'he', '{}'::jsonb, timezone('utc', now()) - interval '3 minutes', timezone('utc', now()) + interval '48 hours'),
    ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', owner_id, 'ฉันชื่อ ดาเนียล', 'th', 'th', '{}'::jsonb, timezone('utc', now()) - interval '2 minutes', timezone('utc', now()) + interval '48 hours')
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
