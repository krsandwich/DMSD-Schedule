-- Hidden months (editor-only). A row present = that calendar month is "hidden":
-- the editor's default landing month skips hidden months and opens the earliest
-- non-hidden month from the current month forward. This is independent of
-- published_months (viewer visibility); a month can be both published and hidden.

create table if not exists hidden_months (
  month date primary key
);

alter table hidden_months enable row level security;

-- Publicly readable (harmless; only used by the editor UI), editor-write.
grant select on hidden_months to anon;

drop policy if exists hidden_months_select on hidden_months;
create policy hidden_months_select on hidden_months for select to public using (true);

drop policy if exists hidden_months_insert on hidden_months;
create policy hidden_months_insert on hidden_months
  for insert to authenticated with check (is_editor());

drop policy if exists hidden_months_delete on hidden_months;
create policy hidden_months_delete on hidden_months
  for delete to authenticated using (is_editor());
