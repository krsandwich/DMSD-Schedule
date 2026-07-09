-- Weekly task # override. The #1–6 task badge is normally derived per-week from
-- the ISO week + eligible-MA rotation (see src/engine/weeklyTasks.ts) and is not
-- stored. This nullable column lets the Editor override an MA's weekly task number
-- from the calendar; null = use the automatic rotation.

alter table daily_assignments add column if not exists weekly_task_no int;
