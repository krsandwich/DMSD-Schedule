-- Missed Shift: manual per-day toggle on MAs (tile editor), rendered as a
-- light red tile on the calendar instead of their usual location color.

alter table daily_assignments
  add column if not exists is_missed_shift boolean not null default false;
