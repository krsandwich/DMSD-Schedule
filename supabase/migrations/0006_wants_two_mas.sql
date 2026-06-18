-- Per-provider "2 MAs" preference: when true, the provider is filled to two MAs
-- before MAs are distributed evenly across the rest. Replaces the old hard-coded
-- "Tricia gets 2 first" rule with a per-month, per-provider setting.

alter table monthly_patterns
  add column if not exists wants_two_mas boolean not null default false;

-- Backfill the historical defaults (Tricia, Monica, Natalie) on existing rows so
-- already-saved months keep getting two MAs without a manual re-save.
update monthly_patterns
set wants_two_mas = true
where staff_id in (
  select id from staff where display_name in ('PA Tricia', 'Dr. Monica', 'PA Natalie')
);
