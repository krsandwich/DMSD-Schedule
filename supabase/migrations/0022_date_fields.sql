-- Migrate the day-of-month int[] fields to real date[] columns, so a single
-- month's setup row can also govern its own trailing spillover days (a month
-- view's last week can spill into the next calendar month) without needing a
-- second row set up on the next month's page. See CLAUDE.md §6/§8.

alter table monthly_patterns
  add column if not exists requested_off_dates  date[] not null default '{}',
  add column if not exists additional_days_dates date[] not null default '{}';

update monthly_patterns
set requested_off_dates = (
  select array_agg((month + (d - 1) * interval '1 day')::date order by d)
  from unnest(requested_off_days) as d
)
where requested_off_days <> '{}';

update monthly_patterns
set additional_days_dates = (
  select array_agg((month + (d - 1) * interval '1 day')::date order by d)
  from unnest(additional_days) as d
)
where additional_days <> '{}';

alter table monthly_patterns
  drop column requested_off_days,
  drop column additional_days;

alter table monthly_holidays
  add column if not exists dates date[] not null default '{}';

update monthly_holidays
set dates = (
  select array_agg((month + (d - 1) * interval '1 day')::date order by d)
  from unnest(days) as d
)
where days <> '{}';

alter table monthly_holidays
  drop column days;
