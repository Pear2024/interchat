insert into public.languages (code, english_name, native_name, hello_example)
values
  ('en', 'English', 'English', 'Hello'),
  ('th', 'Thai', 'ไทย', 'สวัสดี'),
  ('he', 'Hebrew', 'עברית', 'שלום'),
  ('ja', 'Japanese', '日本語', 'こんにちは'),
  ('ko', 'Korean', '한국어', '안녕하세요'),
  ('zh-CN', 'Chinese (Simplified)', '中文（简体）', '你好'),
  ('zh-TW', 'Chinese (Traditional)', '中文（繁體）', '你好'),
  ('es', 'Spanish', 'Español', 'Hola'),
  ('fr', 'French', 'Français', 'Bonjour'),
  ('de', 'German', 'Deutsch', 'Hallo')
on conflict (code) do update
set english_name = excluded.english_name,
    native_name = excluded.native_name,
    hello_example = excluded.hello_example;
