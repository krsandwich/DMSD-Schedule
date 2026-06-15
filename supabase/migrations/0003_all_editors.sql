-- TEMPORARY: make every authenticated user an Editor.
-- Revert by restoring the 'viewer' default + trigger and removing the is_editor() override.

-- New signups become editors.
alter table app_users alter column app_role set default 'editor';

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id, app_role)
  values (new.id, 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Promote everyone who already signed up.
update app_users set app_role = 'editor';

-- Belt-and-suspenders: treat any authenticated user as editor at the policy layer,
-- so writes are allowed even before their app_users row exists.
create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;
