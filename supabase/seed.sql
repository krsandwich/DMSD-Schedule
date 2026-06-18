-- Roster seed (CLAUDE.md §4). Idempotent on display_name.
-- Flags mirror src/engine/__tests__/roster.fixture.ts. MOD / shipping / coverage /
-- social-media are now per-month settings (monthly_patterns), not staff flags.

insert into staff (
  name, display_name, role, can_pcc, receives_mas, needs_pcc, active
) values
  -- Providers
  ('PA Tricia',  'PA Tricia',  'provider', false, true, true, true),
  ('PA Natalie', 'PA Natalie', 'provider', false, true, true, true),
  ('Dr. Monica', 'Dr. Monica', 'provider', false, true, true, true),
  ('RN Steph',   'RN Steph',   'provider', false, true, true, true),
  ('PA Kendra',  'PA Kendra',  'provider', false, true, true, true),
  ('Dr. Shama',  'Dr. Shama',  'provider', false, true, true, true),

  -- Medical Assistants (10)
  ('Reina',    'Reina',    'ma', false, false, false, true),
  ('Sandra',   'Sandra',   'ma', false, false, false, true),
  ('Huaka',    'Huaka',    'ma', false, false, false, true),
  ('Sara I.',  'Sara I.',  'ma', false, false, false, true),
  ('Mya',      'Mya',      'ma', false, false, false, true),
  ('Pu''uwai', 'Pu''uwai', 'ma', false, false, false, true),
  ('Sena',     'Sena',     'ma', false, false, false, true),
  ('Alana',    'Alana',    'ma', false, false, false, true),
  ('Braelynn', 'Braelynn', 'ma', false, false, false, true),
  ('Jordyn',   'Jordyn',   'ma', false, false, false, true),

  -- Patient Care Coordinators (4)
  ('Wendy',    'Wendy',    'pcc', false, false, false, true),
  ('Kalea',    'Kalea',    'pcc', false, false, false, true),
  ('Ellis',    'Ellis',    'pcc', false, false, false, true),
  ('Christie', 'Christie', 'pcc', false, false, false, true),

  -- Estheticians (2) — need PCC, no MAs
  ('Shania', 'Shania', 'esthetician', false, false, true, true),
  ('Mia',    'Mia',    'esthetician', false, false, true, true),

  -- Wellness (1) — needs PCC, no MAs
  ('RN Abby', 'RN Abby', 'wellness', false, false, true, true),

  -- Remote (4) — no remote employee can act as PCC
  ('Catalina', 'Catalina', 'remote', false, false, false, true),
  ('Jade',     'Jade',     'remote', false, false, false, true),
  ('Michelle', 'Michelle', 'remote', false, false, false, true),
  ('Jo',       'Jo',       'remote', false, false, false, true),

  -- Managers (2) — can be assigned as an MA manually in the editor
  ('Keahi', 'Keahi', 'manager', false, false, false, true),
  ('Sara',  'Sara',  'manager', false, false, false, true),

  -- Aesthetic Concierge (2) — can act as PCC
  ('Raella', 'Raella', 'aesthetic_concierge', true, false, false, true),
  ('Maile',  'Maile',  'aesthetic_concierge', true, false, false, true)
on conflict (display_name) do nothing;
