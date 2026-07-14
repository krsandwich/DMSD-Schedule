-- Published months. A row present = that calendar month is published; viewers'
-- UI only shows published months (this gating is UI-only, not enforced by RLS —
-- assignments remain publicly readable). Editors manage the flag from the toolbar.

create table if not exists published_months (
  month date primary key
);

alter table published_months enable row level security;

-- Publicly readable (so the viewer UI knows which months are published);
-- writes remain editor-only. Mirrors the other domain tables.
grant select on published_months to anon;

drop policy if exists published_months_select on published_months;
create policy published_months_select on published_months for select to public using (true);

drop policy if exists published_months_insert on published_months;
create policy published_months_insert on published_months
  for insert to authenticated with check (is_editor());

drop policy if exists published_months_delete on published_months;
create policy published_months_delete on published_months
  for delete to authenticated using (is_editor());
