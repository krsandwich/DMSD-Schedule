-- Provider coverage + per-month provider priority.
--   coverage      : provider both needs coverage when out and can provide it when in.
--   provider_rank : provider MA-fill order (1 = highest); seeded from staff.priority_rank.

alter table monthly_patterns
  add column if not exists coverage      boolean not null default false,
  add column if not exists provider_rank int;

-- Backfill historical defaults so already-saved months behave the same.
update monthly_patterns p
set coverage = true
where p.staff_id in (
  select id from staff where display_name in ('PA Tricia', 'PA Natalie', 'Dr. Monica', 'PA Kendra')
);

update monthly_patterns p
set provider_rank = s.priority_rank
from staff s
where p.staff_id = s.id and s.priority_rank is not null and p.provider_rank is null;
