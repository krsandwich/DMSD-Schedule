#!/usr/bin/env bash
# Daily backup of the DMSD-Schedule database.
#
# `supabase db dump` needs Docker running to work at all (confirmed against
# this project — it fails outright without it), which isn't reliable for an
# unattended daily job. Instead this exports every publicly-readable table as
# JSON via the REST API, using the same anon key the app itself uses (RLS
# already makes these tables public-read, so no new/more-privileged secret is
# needed). Table *schema* is already version-controlled in
# supabase/migrations/, so this only needs to capture the *data*.
#
# Not captured: auth.users (login credentials) and app_users (role mapping) —
# neither is exposed by the public REST API. Recreating an editor login after
# a disaster is a two-minute manual step in the Supabase dashboard; that's an
# acceptable trade-off against not storing a higher-privilege service_role key
# in an unattended background script.
#
# Runs unattended via the LaunchAgent in scripts/com.dmsd-schedule.backup.plist,
# but is safe to run by hand any time: `./scripts/backup-db.sh`.
set -euo pipefail

REPO_DIR="/Users/kyleekrzanich/Desktop/DMSD/DMSD-Schedule"
BACKUP_DIR="${BACKUP_DIR:-$HOME/DMSD-Schedule-Backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DAY="$(date +%Y-%m-%d)"
DEST="$BACKUP_DIR/$DAY"
LOG="$BACKUP_DIR/backup.log"

# Publicly-readable tables (see CLAUDE.md §5 RLS: SELECT is public on all of
# these). Schema for each lives in supabase/migrations/, not here.
TABLES=(staff monthly_patterns daily_assignments monthly_holidays dismissed_warnings published_months hidden_months schedule_snapshots monthly_reminders)

mkdir -p "$DEST"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
notify_failure() {
  osascript -e "display notification \"Check $LOG\" with title \"DMSD Schedule backup FAILED\"" 2>/dev/null || true
}
trap 'log "FAILED (line $LINENO)"; notify_failure' ERR

# Load VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the repo's .env.
if [ ! -f "$REPO_DIR/.env" ]; then
  log "FAILED: $REPO_DIR/.env not found"
  notify_failure
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  log "FAILED: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env"
  notify_failure
  exit 1
fi

log "Starting backup -> $DEST"

for table in "${TABLES[@]}"; do
  out="$DEST/$table.json"
  http_code=$(curl -sS -o "$out" -w '%{http_code}' \
    "$VITE_SUPABASE_URL/rest/v1/$table?select=*" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY")
  if [ "$http_code" != "200" ]; then
    log "FAILED: $table returned HTTP $http_code"
    notify_failure
    exit 1
  fi
  log "  $table.json ($(wc -c < "$out" | tr -d ' ') bytes)"
done

# Record which schema this data corresponds to, so an old backup is self-describing.
git -C "$REPO_DIR" rev-parse HEAD > "$DEST/schema-git-commit.txt" 2>/dev/null || true
ls "$REPO_DIR/supabase/migrations" > "$DEST/schema-migrations.txt" 2>/dev/null || true

log "Backup complete: $(du -sh "$DEST" | cut -f1)"

# Prune backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -type d -name '20*-*-*' -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} \; \
  | while read -r old; do log "Pruned old backup: $old"; done

log "Done."
