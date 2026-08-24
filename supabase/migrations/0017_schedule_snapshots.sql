-- Schedule snapshots (editor-only). One row per calendar month holds the full set
-- of daily assignments captured immediately BEFORE "Generate month" overwrites the
-- schedule, so the editor can restore the pre-generate calendar — including every
-- manual edit. Overwritten on each generate; `rows` is the JSON array of Assignment
-- objects (engine shape, as read by useAssignments). `taken_at` records when.

create table if not exists schedule_snapshots (
  month    date primary key,
  taken_at timestamptz not null default now(),
  rows     jsonb not null default '[]'
);

alter table schedule_snapshots enable row level security;

-- Publicly readable (harmless; only the editor UI uses it), editor-write.
grant select on schedule_snapshots to anon;

drop policy if exists schedule_snapshots_select on schedule_snapshots;
create policy schedule_snapshots_select on schedule_snapshots for select to public using (true);

drop policy if exists schedule_snapshots_insert on schedule_snapshots;
create policy schedule_snapshots_insert on schedule_snapshots
  for insert to authenticated with check (is_editor());

drop policy if exists schedule_snapshots_update on schedule_snapshots;
create policy schedule_snapshots_update on schedule_snapshots
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists schedule_snapshots_delete on schedule_snapshots;
create policy schedule_snapshots_delete on schedule_snapshots
  for delete to authenticated using (is_editor());
