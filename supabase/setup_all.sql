-- DMSD Scheduler — full DB setup. Paste into Supabase dashboard SQL Editor and Run.
-- Generated from supabase/migrations/*.sql + seed.sql


-- ============================================================
-- supabase/migrations/0001_schema.sql
-- ============================================================
-- Dermatology Office Scheduler — base schema (CLAUDE.md §5).

-- enums
create type role as enum (
  'provider','ma','pcc','esthetician','wellness','remote','manager','aesthetic_concierge'
);
create type location as enum ('kona','waimea','remote','off');
create type app_role as enum ('editor','viewer');

-- who can log in and what they can do
create table app_users (
  id        uuid primary key references auth.users(id) on delete cascade,
  app_role  app_role not null default 'viewer'
);

create table staff (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  display_name           text not null unique,
  role                   role not null,
  priority_rank          int,                              -- providers only
  mod_priority           int,                              -- 1=Keahi,2=Sara,3=Reina; null = not eligible
  in_ma_pool             boolean not null default false,
  can_social_media       boolean not null default false,
  can_pcc                boolean not null default false,   -- aesthetic concierge = true
  can_shipping           boolean not null default false,   -- pcc + aesthetic concierge = true
  receives_mas           boolean not null default false,   -- the 6 providers = true
  needs_pcc              boolean not null default false,   -- providers, estheticians, wellness = true
  -- provider needs coverage when out: providers except Steph & Shama = true
  needs_coverage_when_out boolean not null default false,
  -- may cover absent providers: any provider except Steph = true
  can_cover_providers    boolean not null default false,
  active                 boolean not null default true
);

-- monthly inputs set by the Editor (one row per staff per month)
create table monthly_patterns (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references staff(id) on delete cascade,
  month               date not null,                 -- first day of month
  usual_weekdays      int[] not null default '{}',   -- 1=Mon .. 5=Fri
  location_by_weekday jsonb not null default '{}',    -- {"1":"kona","2":"waimea"}
  requested_off_days  int[] not null default '{}',    -- days of month, expanded from "1-3, 8-11"
  unique (staff_id, month)
);

-- generated + hand-edited daily assignments (one row per staff per working day)
create table daily_assignments (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null,
  staff_id              uuid not null references staff(id) on delete cascade,
  location              location not null,
  is_mod                boolean not null default false,
  assigned_provider_id  uuid references staff(id),       -- MA -> their provider
  ma_slot               int,                             -- 1 or 2, order under provider
  pcc_covers_ids        uuid[] not null default '{}',    -- PCC/concierge -> targets coordinated
  provider_coverage_ids uuid[] not null default '{}',    -- provider -> absent providers covered
  is_shipping           boolean not null default false,
  is_social_media       boolean not null default false,
  custom_text           text,
  unique (date, staff_id)
);

create index daily_assignments_date_idx on daily_assignments (date);

-- persist warning dismissals; warnings themselves are computed live
create table dismissed_warnings (
  date    date not null,
  type    text not null,
  ref_key text not null,             -- e.g. provider id or 'mod'
  primary key (date, type, ref_key)
);


-- ============================================================
-- supabase/migrations/0002_rls.sql
-- ============================================================
-- Auth helpers + Row Level Security (CLAUDE.md §5).
-- Single-editor rule is enforced here at the DB layer, not just the UI.

-- On first login, insert an app_users row defaulting to 'viewer'.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id, app_role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- True when the current user's app_role = 'editor'.
create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and app_role = 'editor'
  );
$$;

-- Enable RLS everywhere.
alter table app_users         enable row level security;
alter table staff             enable row level security;
alter table monthly_patterns  enable row level security;
alter table daily_assignments enable row level security;
alter table dismissed_warnings enable row level security;

-- app_users: a user may read their own row (to discover their role).
create policy app_users_select_self on app_users
  for select to authenticated using (id = auth.uid());

-- Domain tables: authenticated users may SELECT; only the editor may write.
do $$
declare t text;
begin
  foreach t in array array['staff','monthly_patterns','daily_assignments','dismissed_warnings']
  loop
    execute format('create policy %1$s_select on %1$s for select to authenticated using (true);', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (is_editor());', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (is_editor()) with check (is_editor());', t);
    execute format('create policy %1$s_delete on %1$s for delete to authenticated using (is_editor());', t);
  end loop;
end $$;

-- Realtime: broadcast daily_assignments changes to Viewers.
alter publication supabase_realtime add table daily_assignments;


-- ============================================================
-- supabase/migrations/0003_all_editors.sql
-- ============================================================
-- TEMPORARY: make every authenticated user an Editor.
-- Revert by restoring the 'viewer' default + trigger and removing the is_editor() override.

-- New signups become editors.
alter table app_users alter column app_role set default 'editor';

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id, app_role)
  values (new.id, 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Promote everyone who already signed up.
update app_users set app_role = 'editor';

-- Belt-and-suspenders: treat any authenticated user as editor at the policy layer,
-- so writes are allowed even before their app_users row exists.
create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;


-- ============================================================
-- supabase/seed.sql
-- ============================================================
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

