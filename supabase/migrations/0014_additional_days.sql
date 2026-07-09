-- Additional working days. The inverse of requested_off_days: force a person to
-- work on specific days-of-month (even ones they don't usually work, or ones they
-- requested off), at a chosen location. additional_days_location holds the location
-- for those days as a weekday-location string ('kona' | 'waimea' | 'remote' |
-- 'alternating'); null / 'off' means the additional days have no effect.

alter table monthly_patterns
  add column if not exists additional_days          int[] not null default '{}',
  add column if not exists additional_days_location text;
