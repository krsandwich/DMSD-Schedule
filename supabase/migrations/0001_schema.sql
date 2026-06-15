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
