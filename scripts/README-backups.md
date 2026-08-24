# Daily database backups

`backup-db.sh` exports every table's data as JSON to a dated folder, once a
day, via a LaunchAgent.

**Why JSON via REST, not `pg_dump`:** `supabase db dump` requires Docker to be
installed *and running* — not reliable for an unattended 6am job. Instead the
script hits the same public REST API the app itself uses (RLS already makes
these tables public-read via the anon key in `.env`), so no new or
higher-privileged secret is needed and there's no Docker dependency. Table
*schema* is already version-controlled in `supabase/migrations/`, so only the
*data* needs backing up.

**Not captured:** `auth.users` (login credentials) and `app_users` (role
mapping) — neither is exposed by the public REST API. If ever needed, restore
by having the editor sign in again (an `app_users` row is created
automatically on first login). This is a deliberate trade-off: capturing auth
data would require the `service_role` key, which bypasses RLS entirely and
shouldn't live in an unattended background script for a low-value recovery
(one or two editor logins).

Backups land in `~/DMSD-Schedule-Backups/` by default — **outside this repo**,
so they can never end up in a commit. Set `BACKUP_DIR` to change that.

**The script that actually runs lives at `~/.dmsd-schedule/backup-db.sh`, not
in this repo.** Confirmed by testing: launchd cannot read or execute a script
located under `~/Desktop` at all — macOS's TCC privacy protection on the
Desktop folder blocks it outright (`Operation not permitted`), even though
the identical script runs fine when launched from Terminal (which already has
Desktop access). The version in this repo, `scripts/backup-db.sh`, is the
one meant to be read/edited; `~/.dmsd-schedule/backup-db.sh` is a
self-contained installed copy (it inlines the Supabase URL/anon key instead
of sourcing `.env`, since reading anything under Desktop hits the same
restriction). See "Keeping the installed copy in sync" below.

## Install (one-time)

```bash
cp scripts/com.dmsd-schedule.backup.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dmsd-schedule.backup.plist
```

`RunAtLoad` means it also runs once immediately — check
`~/DMSD-Schedule-Backups/backup.log` a few seconds later to confirm it worked.

## Keeping the installed copy in sync

If you edit `scripts/backup-db.sh` in this repo (e.g. change the table list),
copy your changes into `~/.dmsd-schedule/backup-db.sh` too — that's the file
launchd actually runs — then it picks up the change on its next scheduled
run automatically (no reload needed, since the plist points at a stable path,
not the file's contents).

## Change the run time

Edit the `Hour`/`Minute` in `~/Library/LaunchAgents/com.dmsd-schedule.backup.plist`
(the installed copy, not the one in this repo), then reload:

```bash
launchctl bootout gui/$(id -u)/com.dmsd-schedule.backup
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dmsd-schedule.backup.plist
```

## Run manually / test

```bash
./scripts/backup-db.sh          # repo copy — fine to run from Terminal
~/.dmsd-schedule/backup-db.sh   # the actual installed copy, same way launchd runs it
```

## Uninstall

```bash
launchctl bootout gui/$(id -u)/com.dmsd-schedule.backup
rm ~/Library/LaunchAgents/com.dmsd-schedule.backup.plist
```

## What's in a backup folder

```
~/DMSD-Schedule-Backups/2026-08-24/
  staff.json
  monthly_patterns.json
  daily_assignments.json
  monthly_holidays.json
  dismissed_warnings.json
  published_months.json
  hidden_months.json
  schedule_snapshots.json
  schema-git-commit.txt      # repo commit the schema matched at backup time
  schema-migrations.txt      # migration files applied at backup time
```

Both `schema-*` files are best-effort — they read from the repo under
Desktop, so under launchd they may come back empty (seen in testing:
`schema-git-commit.txt` succeeded, `schema-migrations.txt` didn't). Harmless;
they're metadata, not the actual backed-up data.

## Restore from a backup

1. Get the schema in place: `supabase db push` on a project whose migrations
   match `schema-migrations.txt` (or just the current `supabase/migrations/`
   if restoring into today's schema).
2. Re-insert each table's rows via the REST API (needs the **service_role**
   key for this one-off, since it must bypass RLS to write) — for each
   `<table>.json`:
   ```bash
   curl -X POST "$SUPABASE_URL/rest/v1/<table>" \
     -H "apikey: $SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -H "Prefer: resolution=merge-duplicates" \
     -d @<table>.json
   ```
   Insert in this order so foreign keys resolve: `staff` →
   `monthly_patterns`, `daily_assignments`, `dismissed_warnings` → the rest
   (order doesn't matter among the remainder).
3. Have the editor sign in once to recreate their `app_users` row.

## Note on the missed-run guarantee

`StartCalendarInterval` schedules ~ "run at 6:00 AM." If the Mac is
asleep/off at that moment, macOS fires it shortly after the next wake/login
rather than skipping the day — but if the Mac is off for several days
straight, only one catch-up run happens, not one per missed day. For a
machine that's off most nights, consider moving the time to whenever it's
reliably on (or leave the Mac plugged in and set to wake automatically).
