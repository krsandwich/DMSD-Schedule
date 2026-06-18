-- DMSD Scheduler — full DB setup (idempotent / re-runnable).
-- Paste into Supabase dashboard SQL Editor and Run.
-- Safe to run repeatedly: it drops our objects first, then recreates them.
-- NOTE: this resets the scheduler tables. Only the app's own tables are touched.

-- ============================================================
-- 0) Teardown (so the script can be re-run after a partial apply)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop function if exists is_editor() cascade;

drop table if exists dismissed_warnings cascade;
drop table if exists daily_assignments cascade;
drop table if exists monthly_holidays cascade;
drop table if exists monthly_patterns cascade;
drop table if exists app_users cascade;
drop table if exists staff cascade;

drop type if exists app_role cascade;
drop type if exists location cascade;
drop type if exists role cascade;

-- ============================================================
-- 1) Schema
-- ============================================================
create type role as enum (
  'provider','ma','pcc','esthetician','wellness','remote','manager','aesthetic_concierge'
);
create type location as enum ('kona','waimea','remote','off');
create type app_role as enum ('editor','viewer');

create table app_users (
  id        uuid primary key references auth.users(id) on delete cascade,
  app_role  app_role not null default 'editor'   -- TEMPORARY: everyone is an editor
);

create table staff (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  display_name text not null unique,
  role         role not null,
  can_pcc      boolean not null default false,   -- aesthetic concierge can PCC
  receives_mas boolean not null default false,   -- the 6 providers
  needs_pcc    boolean not null default false,   -- providers, estheticians, wellness
  active       boolean not null default true
);

create table monthly_patterns (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references staff(id) on delete cascade,
  month               date not null,
  usual_weekdays      int[] not null default '{}',
  location_by_weekday jsonb not null default '{}',
  requested_off_days  int[] not null default '{}',
  default_target_id   uuid references staff(id) on delete set null, -- MA->provider, PCC->target
  wants_two_mas       boolean not null default false,               -- provider filled to 2 MAs first
  coverage            boolean not null default false,               -- provider needs + provides coverage
  provider_rank       int,                                          -- provider fill order, 1 = highest
  mod_rank            int,                                          -- MOD rank, 1 = highest
  shipping_rank       int,                                          -- shipping rank, 1 = highest
  unique (staff_id, month)
);

create table daily_assignments (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null,
  staff_id              uuid not null references staff(id) on delete cascade,
  location              location not null,
  is_mod                boolean not null default false,
  assigned_provider_id  uuid references staff(id),
  ma_slot               int,
  pcc_covers_ids        uuid[] not null default '{}',
  provider_coverage_ids uuid[] not null default '{}',
  is_shipping           boolean not null default false,
  is_social_media       boolean not null default false,
  custom_text           text,
  unique (date, staff_id)
);

create index daily_assignments_date_idx on daily_assignments (date);

create table dismissed_warnings (
  date    date not null,
  type    text not null,
  ref_key text not null,
  primary key (date, type, ref_key)
);

create table monthly_holidays (
  month date primary key,
  days  int[] not null default '{}'
);

-- ============================================================
-- 2) Auth helpers + RLS
-- ============================================================

-- On first login, create an app_users row (editor, temporarily).
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- TEMPORARY: any authenticated user is treated as an editor.
create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

alter table app_users          enable row level security;
alter table staff              enable row level security;
alter table monthly_patterns   enable row level security;
alter table monthly_holidays   enable row level security;
alter table daily_assignments  enable row level security;
alter table dismissed_warnings enable row level security;

create policy app_users_select_self on app_users
  for select to authenticated using (id = auth.uid());

-- Schedule tables are publicly readable (read-only); writes are editor-only.
grant select on staff, monthly_patterns, monthly_holidays, daily_assignments, dismissed_warnings to anon;

do $$
declare t text;
begin
  foreach t in array array['staff','monthly_patterns','monthly_holidays','daily_assignments','dismissed_warnings']
  loop
    execute format('create policy %1$s_select on %1$s for select to public using (true);', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (is_editor());', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (is_editor()) with check (is_editor());', t);
    execute format('create policy %1$s_delete on %1$s for delete to authenticated using (is_editor());', t);
  end loop;
end $$;

-- Realtime: broadcast daily_assignments changes to Viewers (guarded).
do $$
begin
  alter publication supabase_realtime add table daily_assignments;
exception
  when duplicate_object then null;
  when undefined_object then null;  -- publication not present in this project
end $$;

-- ============================================================
-- 3) Roster seed (CLAUDE.md §4)
-- ============================================================
insert into staff (
  name, display_name, role, can_pcc, receives_mas, needs_pcc, active
) values
  ('PA Tricia',  'PA Tricia',  'provider', false, true, true, true),
  ('PA Natalie', 'PA Natalie', 'provider', false, true, true, true),
  ('Dr. Monica', 'Dr. Monica', 'provider', false, true, true, true),
  ('RN Steph',   'RN Steph',   'provider', false, true, true, true),
  ('PA Kendra',  'PA Kendra',  'provider', false, true, true, true),
  ('Dr. Shama',  'Dr. Shama',  'provider', false, true, true, true),

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

  ('Wendy',    'Wendy',    'pcc', false, false, false, true),
  ('Kalea',    'Kalea',    'pcc', false, false, false, true),
  ('Ellis',    'Ellis',    'pcc', false, false, false, true),
  ('Christie', 'Christie', 'pcc', false, false, false, true),

  ('Shania', 'Shania', 'esthetician', false, false, true, true),
  ('Mia',    'Mia',    'esthetician', false, false, true, true),

  ('RN Abby', 'RN Abby', 'wellness', false, false, true, true),

  ('Catalina', 'Catalina', 'remote', false, false, false, true),
  ('Jade',     'Jade',     'remote', false, false, false, true),
  ('Michelle', 'Michelle', 'remote', false, false, false, true),
  ('Jo',       'Jo',       'remote', false, false, false, true),

  ('Keahi', 'Keahi', 'manager', false, false, false, true),
  ('Sara',  'Sara',  'manager', false, false, false, true),

  ('Raella', 'Raella', 'aesthetic_concierge', true, false, false, true),
  ('Maile',  'Maile',  'aesthetic_concierge', true, false, false, true)
on conflict (display_name) do nothing;
