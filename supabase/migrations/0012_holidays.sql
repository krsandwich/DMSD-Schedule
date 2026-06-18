-- Office holidays, set per month by the Editor. On a holiday weekday no staff are
-- scheduled and the calendar greys the day out. Stored as day-of-month integers
-- (e.g. {1,4,5}) keyed by the first day of the month, mirroring monthly_patterns.

create table if not exists monthly_holidays (
  month date primary key,
  days  int[] not null default '{}'
);

alter table monthly_holidays enable row level security;

-- Publicly readable (matches the other domain tables, see 0011_public_read.sql);
-- writes remain editor-only.
grant select on monthly_holidays to anon;

drop policy if exists monthly_holidays_select on monthly_holidays;
create policy monthly_holidays_select on monthly_holidays for select to public using (true);

drop policy if exists monthly_holidays_insert on monthly_holidays;
create policy monthly_holidays_insert on monthly_holidays
  for insert to authenticated with check (is_editor());

drop policy if exists monthly_holidays_update on monthly_holidays;
create policy monthly_holidays_update on monthly_holidays
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists monthly_holidays_delete on monthly_holidays;
create policy monthly_holidays_delete on monthly_holidays
  for delete to authenticated using (is_editor());
