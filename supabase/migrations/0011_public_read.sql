-- Make the schedule publicly readable (READ-ONLY) so logged-out visitors can view
-- it and page between months. Writes remain editor-only (insert/update/delete
-- policies are unchanged and still require is_editor()).

grant select on staff, monthly_patterns, daily_assignments, dismissed_warnings to anon;

do $$
declare t text;
begin
  foreach t in array array['staff','monthly_patterns','daily_assignments','dismissed_warnings']
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    -- `public` covers both anon (logged-out) and authenticated roles.
    execute format('create policy %1$s_select on %1$s for select to public using (true);', t);
  end loop;
end $$;
