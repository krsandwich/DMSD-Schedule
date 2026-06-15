-- Auth helpers + Row Level Security (CLAUDE.md §5).
-- Single-editor rule is enforced here at the DB layer, not just the UI.

-- On first login, insert an app_users row defaulting to 'viewer'.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id, app_role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- True when the current user's app_role = 'editor'.
create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and app_role = 'editor'
  );
$$;

-- Enable RLS everywhere.
alter table app_users         enable row level security;
alter table staff             enable row level security;
alter table monthly_patterns  enable row level security;
alter table daily_assignments enable row level security;
alter table dismissed_warnings enable row level security;

-- app_users: a user may read their own row (to discover their role).
create policy app_users_select_self on app_users
  for select to authenticated using (id = auth.uid());

-- Domain tables: authenticated users may SELECT; only the editor may write.
do $$
declare t text;
begin
  foreach t in array array['staff','monthly_patterns','daily_assignments','dismissed_warnings']
  loop
    execute format('create policy %1$s_select on %1$s for select to authenticated using (true);', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (is_editor());', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (is_editor()) with check (is_editor());', t);
    execute format('create policy %1$s_delete on %1$s for delete to authenticated using (is_editor());', t);
  end loop;
end $$;

-- Realtime: broadcast daily_assignments changes to Viewers.
alter publication supabase_realtime add table daily_assignments;
