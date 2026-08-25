-- Special Reminders (Monthly Setup, editor-only to write). Free-text, one row
-- per month, parsed client-side into day-of-month -> reminder text(s) — lines
-- like "20: Monthly staff meeting". Deliberately month-specific: unlike
-- weekday/location patterns, this never carries forward via "Copy last month".

create table if not exists monthly_reminders (
  month date primary key,
  text  text not null default ''
);

alter table monthly_reminders enable row level security;

-- Publicly readable (so the calendar can show reminders to Viewers too);
-- writes remain editor-only. Mirrors the other domain tables.
grant select on monthly_reminders to anon;

drop policy if exists monthly_reminders_select on monthly_reminders;
create policy monthly_reminders_select on monthly_reminders for select to public using (true);

drop policy if exists monthly_reminders_insert on monthly_reminders;
create policy monthly_reminders_insert on monthly_reminders
  for insert to authenticated with check (is_editor());

drop policy if exists monthly_reminders_update on monthly_reminders;
create policy monthly_reminders_update on monthly_reminders
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists monthly_reminders_delete on monthly_reminders;
create policy monthly_reminders_delete on monthly_reminders
  for delete to authenticated using (is_editor());
