-- Roster seed (CLAUDE.md §4). Idempotent on display_name.
-- Flags mirror src/engine/__tests__/roster.fixture.ts.

insert into staff (
  name, display_name, role, priority_rank, mod_priority, in_ma_pool,
  can_social_media, can_pcc, can_shipping, receives_mas, needs_pcc,
  needs_coverage_when_out, can_cover_providers, active
) values
  -- Providers (priority: Tricia -> Natalie -> Monica -> Steph -> Kendra -> Shama)
  ('PA Tricia',       'PA Tricia',       'provider', 1, null, false, false, false, false, true, true, true,  true,  true),
  ('PA Natalie',      'PA Natalie',      'provider', 2, null, false, false, false, false, true, true, true,  true,  true),
  ('Dr. Monica',      'Dr. Monica',      'provider', 3, null, false, false, false, false, true, true, true,  true,  true),
  -- Steph: never needs coverage when out; may NOT cover others.
  ('RN Steph',        'RN Steph',        'provider', 4, null, false, false, false, false, true, true, false, false, true),
  ('PA Kendra',       'PA Kendra',       'provider', 5, null, false, false, false, false, true, true, true,  true,  true),
  -- Shama: never needs coverage when out; MAY cover others.
  ('Dr. Shama Brown', 'Dr. Shama Brown', 'provider', 6, null, false, false, false, false, true, true, false, true,  true),

  -- Medical Assistants (10)
  ('Reina',    'Reina',    'ma', null, 3,    false, false, false, false, false, false, false, false, true),
  ('Sandra',   'Sandra',   'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Huaka',    'Huaka',    'ma', null, null, false, true,  false, false, false, false, false, false, true),
  ('Sara I.',  'Sara I.',  'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Mya',      'Mya',      'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Pu''uwai', 'Pu''uwai', 'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Sena',     'Sena',     'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Alana',    'Alana',    'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Braelynn', 'Braelynn', 'ma', null, null, false, false, false, false, false, false, false, false, true),
  ('Jordyn',   'Jordyn',   'ma', null, null, false, false, false, false, false, false, false, false, true),

  -- Patient Care Coordinators (4) — handle shipping
  ('Wendy',    'Wendy',    'pcc', null, null, false, false, true, false, false, false, false, false, true),
  ('Kalea',    'Kalea',    'pcc', null, null, false, false, true, false, false, false, false, false, true),
  ('Ellis',    'Ellis',    'pcc', null, null, false, false, true, false, false, false, false, false, true),
  ('Christie', 'Christie', 'pcc', null, null, false, false, true, false, false, false, false, false, true),

  -- Estheticians (2) — need PCC, no MAs
  ('Shania', 'Shania', 'esthetician', null, null, false, false, false, false, false, true, false, false, true),
  ('Mia',    'Mia',    'esthetician', null, null, false, false, false, false, false, true, false, false, true),

  -- Wellness (1) — needs PCC, no MAs
  ('RN Abby', 'RN Abby', 'wellness', null, null, false, false, false, false, false, true, false, false, true),

  -- Remote (4)
  ('Catalina', 'Catalina', 'remote', null, null, false, false, false, false, false, false, false, false, true),
  ('Jade',     'Jade',     'remote', null, null, false, false, true,  false, false, false, false, false, true),
  ('Michelle', 'Michelle', 'remote', null, null, false, false, false, false, false, false, false, false, true),
  ('Jo',       'Jo',       'remote', null, null, false, false, false, false, false, false, false, false, true),

  -- Managers (2) — both MOD-eligible; Keahi also in MA pool
  ('Keahi', 'Keahi', 'manager', null, 1, true,  false, false, false, false, false, false, false, true),
  ('Sara',  'Sara',  'manager', null, 2, false, false, false, false, false, false, false, false, true),

  -- Aesthetic Concierge (2) — can act as PCC and handle shipping
  ('Raella', 'Raella', 'aesthetic_concierge', null, null, false, true, true, false, false, false, false, false, true),
  ('Maile',  'Maile',  'aesthetic_concierge', null, null, false, true, true, false, false, false, false, false, true)
on conflict (display_name) do nothing;
