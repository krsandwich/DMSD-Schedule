# Dermatology Office Scheduler — Build Brief

> **For Claude Code.** This is the complete spec for building the app. It is self-contained — you should not need any external context. Save it as `CLAUDE.md` (or `docs/SPEC.md`) in the repo root so it stays loaded. Office operates **Monday–Friday only**.

---

## 1. What we're building

An internal scheduling app for a dermatology practice with three locations. **One Editor** sets monthly work patterns and time-off, the app **auto-generates** a month of daily staffing using the rules in §6, and the Editor **drags-and-drops** to adjust. **Multiple Viewers** see a live, read-only calendar. The app validates assignments and surfaces dismissible warnings.

---

## 2. Tech stack (locked)

| Concern | Choice | Notes |
|---|---|---|
| Frontend | **React + Vite** | SPA |
| Language | **TypeScript** | *Added.* The generation engine is rules-heavy; static types prevent whole classes of scheduling bugs. |
| Routing | **React Router** | |
| Styling | **Tailwind CSS** | Desktop-first; should stay usable on tablet. |
| DB + Auth | **Supabase** (Postgres) | |
| Login | **Username + password** | Editor types a username; the app appends `@drmonicascheel.com` and signs in via Supabase email/password. (Replaces the original GitHub OAuth plan.) |
| Migrations | **Supabase CLI** | Project already linked. All schema changes via migrations in `/supabase/migrations`. |
| Data fetching | **TanStack Query** | *Added.* Caching + invalidation around Supabase calls. |
| Live updates | **Supabase Realtime** | *Added.* Viewers see Editor changes without refresh — directly serves the one-editor/many-viewer requirement. |
| Drag-and-drop | **dnd-kit** | *Added.* Reassign staff between providers, locations, MOD, coverage, PCC targets. |
| Dates | **date-fns** | *Added.* Lightweight weekday/range math. |
| Tests | **Vitest** | *Added.* Unit-test the generation engine per rule. |
| Excel export | **exceljs** | *Added.* Powers the calendar's "Export Excel" button (`src/lib/exportMonth.ts`). |

**Why this stack fits:** Postgres models the relational roster/assignment data naturally; Supabase RLS enforces "only the Editor can write" at the database layer (not just the UI); Realtime makes the Viewer experience live for free.

---

## 3. Project structure

```
/src
  /lib
    supabase.ts                # typed Supabase client
    queryClient.ts             # TanStack Query setup
  /engine                      # PURE, framework-agnostic generation logic
    types.ts                   # domain types (Staff, Assignment, Warning, etc.)
    generateMonth.ts           # entry point: (patterns, month) -> { assignments, warnings }
    attendance.ts              # Step 1
    mod.ts                     # Step 2
    coverage.ts                # Step 3 (+ weekly even-distribution)
    assignMAs.ts               # Step 4
    assignPCCs.ts              # Step 5
    warnings.ts                # Step 9
    __tests__/                 # Vitest: one spec file per rule
  /components
    calendar/                  # WeekGrid, StaffTile, AssignmentEditor, Toolbar, badges, emojis
    common/                    # Button, Spinner, SignInForm/Dialog, ...
  /pages
    LoginPage.tsx
    SchedulePage.tsx           # the calendar
    MonthlySetupPage.tsx       # work patterns, time-off, holidays callout
    RosterPage.tsx             # add / (de)activate / permanently delete staff
  /hooks                       # useStaff, useMonthlyPatterns, useMonthHolidays, useAssignments, useRealtime...
  App.tsx  main.tsx  router.tsx
/supabase
  /migrations
  config.toml
```

**Hard rule:** keep `/engine` free of React and Supabase imports. It takes plain data in and returns plain data out, so it can be unit-tested in isolation and re-run anywhere.

---

## 4. Roster & roles

### Locations (enum, color-coded in UI)
| Location | Color |
|---|---|
| `kona` | Purple |
| `waimea` | Blue |
| `remote` | Green |
| `off` (not scheduled to work) | Light grey |
| Request Off (R/O) — scheduled that weekday but requested off | Pink |

*(R/O is not a distinct `location` value; it's a display distinction. A person lands in the pink **Request Off (R/O)** row only when the day is one of their usual weekdays **and** in their `requested_off_days`; otherwise a non-working day is plain grey **Off**.)*

### People
**Providers (6)** — receive MAs:
PA Tricia, PA Natalie, Dr. Monica, RN Steph, PA Kendra, Dr. Shama.
*Priority order (MA fill + coverage tie-breaks):* Tricia → Natalie → Monica → Steph → Kendra → Shama.

**Medical Assistants (10):** Reina, Sandra, Huaka, Sara I., Mya, Pu'uwai, Sena, Alana, Braelynn, Jordyn.
- Reina is MOD-eligible.
- Huaka can be manually assigned to **Social Media**.

**Patient Care Coordinators (4):** Wendy, Kalea, Ellis, Christie.

**Estheticians (2):** Shania, Mia.

**Wellness (1):** RN Abby — does **not** receive MAs.

**Remote (4):** Catalina (PCC Support), Jade (phones/PCC), Michelle (Concierge), Jo (Admin Asst).

**Managers (2):** Sara, Keahi. Both MOD-eligible. Keahi is also in the **MA pool** and does admin work.

**Aesthetic Concierge (2):** Raella, Maile. Can also act as **PCC** (to fill PCC gaps) and handle **Shipping**.

**Interns (0+):** none by default — added as needed via Roster. No defaults/ranks (not MOD/shipping/coverage-eligible, don't receive or provide MAs/PCC). Their only Monthly Setup field is **Shadows**: which MA they're paired with that month, reusing `monthly_patterns.default_target_id` (a `role === 'ma'` staff id) — purely informational, shown on the calendar as a badge on their tile; the engine never auto-assigns it. Standard attendance (weekday/location/time-off) still applies. Their calendar row is omitted entirely on weeks with no interns.

**MOD eligibility & priority:** Keahi (default) → Sara → Reina.

---

## 5. Data model (Postgres / Supabase)

Create via Supabase CLI migrations. Suggested schema — adapt naming as needed but preserve the relationships. *(This snippet is illustrative of the original design; it has since grown several columns/tables — see the "current schema" note right after it, and `/supabase/migrations` for the real source of truth.)*

```sql
-- enums
create type role        as enum ('provider','ma','pcc','esthetician','wellness','remote','manager','aesthetic_concierge');
create type location     as enum ('kona','waimea','remote','off');
create type app_role     as enum ('editor','viewer');

-- who can log in and what they can do
create table app_users (
  id          uuid primary key references auth.users(id),
  app_role    app_role not null default 'viewer'
);

create table staff (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  display_name    text not null,
  role            role not null,
  priority_rank   int,            -- providers only, for fill/tie-break ordering
  mod_priority    int,            -- 1=Keahi, 2=Sara, 3=Reina; null = not MOD-eligible
  in_ma_pool      boolean not null default false,
  can_social_media boolean not null default false,
  can_pcc         boolean not null default false,  -- aesthetic concierge = true
  can_shipping    boolean not null default false,  -- pcc + aesthetic concierge = true
  receives_mas    boolean not null default false,  -- the 6 providers = true
  needs_pcc       boolean not null default false,  -- providers, estheticians, wellness = true
  active          boolean not null default true
);

-- monthly inputs set by the Editor (one row per staff per month)
create table monthly_patterns (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references staff(id),
  month               date not null,            -- first day of month
  usual_weekdays      int[] not null default '{}', -- 1=Mon .. 5=Fri
  location_by_weekday jsonb not null default '{}', -- {"1":"kona","2":"waimea"}
  requested_off_days  int[] not null default '{}', -- days of month, expanded from "1-3, 8-11"
  additional_days     int[] not null default '{}', -- force-work days, inverse of requested_off_days
  additional_days_location text,                   -- 'kona'|'waimea'|'remote'|'alternating'|'waimea_kona'|null; null/'off' = no effect
  unique (staff_id, month)
);

-- generated + hand-edited daily assignments (one row per staff per working day)
create table daily_assignments (
  id                   uuid primary key default gen_random_uuid(),
  date                 date not null,
  staff_id             uuid not null references staff(id),
  location             location not null,
  is_mod               boolean not null default false,
  assigned_provider_id uuid references staff(id),     -- MA -> their provider
  ma_slot              int,                            -- 1 or 2, order under provider
  pcc_covers_ids       uuid[] not null default '{}',   -- PCC/concierge -> targets coordinated
  provider_coverage_ids uuid[] not null default '{}',  -- provider -> absent providers covered
  is_shipping          boolean not null default false,
  is_social_media      boolean not null default false,
  custom_text          text,
  weekly_task_no       int,                            -- override for the derived weekly #1-6 MA task badge
  unique (date, staff_id)
);

-- persist warning dismissals; warnings themselves are computed live
create table dismissed_warnings (
  date     date not null,
  type     text not null,
  ref_key  text not null,           -- e.g. provider id or 'mod'
  primary key (date, type, ref_key)
);

-- per-month office holidays (set by the Editor); day-of-month integers
create table monthly_holidays (
  month date primary key,           -- first day of month
  days  int[] not null default '{}' -- e.g. {1,4,5}; holiday weekdays = office closed
);

-- a row present = that month is published (visible to Viewers); UI-only gate,
-- not enforced by RLS (assignments stay publicly readable regardless)
create table published_months (
  month date primary key
);

-- a row present = that month is hidden from the Editor's default-landing search
create table hidden_months (
  month date primary key
);

-- snapshot of daily_assignments taken right before "Generate month" overwrites
-- them, so the Editor can revert a generate (including manual edits) afterward
create table schedule_snapshots (
  month    date primary key,
  taken_at timestamptz not null default now(),
  rows     jsonb not null default '[]'  -- Assignment[] as of just before generation
);
```

**Weekly coverage counter** (for even coverage distribution) is **derived** — compute from `provider_coverage_ids` over the current week rather than storing it.

### Auth / RLS
- Login via Supabase email/password. The Editor types a **username**; the app appends `@drmonicascheel.com` and signs in. On first login, an `app_users` row is inserted; the Editor is promoted manually (seed/admin).
- Helper: `is_editor()` returns true when the user is signed in (temporarily simplified — see `0003_all_editors.sql` / `setup_all.sql`; originally `app_role = 'editor'`).
- RLS on `staff`, `monthly_patterns`, `monthly_holidays`, `daily_assignments`, `dismissed_warnings`, `published_months`, `hidden_months`, `schedule_snapshots`: **publicly readable (`SELECT`, incl. logged-out viewers); only `is_editor()` may `INSERT/UPDATE/DELETE`.**

---

## 6. Generation algorithm

Run per weekday (Mon–Fri). A person **works** that day if it's one of their `usual_weekdays` and the day-of-month is not in `requested_off_days`. Everyone working gets their location from `location_by_weekday`; non-working people render `off` (grey). Steps run in order — later steps depend on earlier ones.

**Month = whole weeks.** A month is generated and displayed as complete Mon–Fri weeks: a week belongs to the month containing its **Monday**, so a month spans from its first Monday through the Friday of the week containing its last Monday (e.g. June 2026 = Jun 1 → Jul 3, July 2026 = Jul 6 → Jul 31; adjacent months never overlap or leave a gap). Trailing spillover days resolve against the **next** calendar month's patterns, so generation pulls both months' patterns.

**Holidays.** Days listed in `monthly_holidays` are skipped entirely — no staff are scheduled, no warnings are raised, and the calendar greys the day out.

### Step 1 — Attendance & locations
Resolve present/off for each staff member and set each present person's location. (Holiday weekdays are skipped before this step.)
- **Additional days (force-work):** the inverse of requested-off. A day-of-month in `additional_days` makes the person work at `additional_days_location`, **overriding** both their usual weekday pattern and any requested-off for that day. `null` / `off` location = no effect.
- **Alternating locations:** a weekday set to `alternating` (Kona / Waimea) or `waimea_kona` (Waimea / Kona) switches every **two weeks within the month view** — weeks 1–2 = the first location, weeks 3–4 = the second, then the two-week block repeats (so a 5th week returns to the first). The block index resets at each month's first Monday. *(Changed from the earlier continuous weekly ISO-parity rotation per client request.)*

### Step 2 — MOD (exactly one per day)
- MOD is **data-driven**, not hard-coded: any staff member can be made MOD-eligible via a per-month **MOD rank** in Monthly Setup (`monthly_patterns.mod_rank`; 1 = highest priority). Keahi → Sara → Reina is the seeded default ranking, not a fixed rule.
- Choose the **lowest-mod_rank person who is working AT KONA** that day — being MOD-ranked isn't enough; they must be scheduled at Kona. (This location gate isn't optional/configurable.)
- MOD is **standalone**: remove that person from the MA pool; they are not placed under any provider.
- If no eligible person is working at Kona → **warning** (`no_mod`; a MOD must always exist). If more than one person ends up flagged MOD the same day (can happen after regenerating one person independently — see §8) → separate **warning** (`multiple_mod`).

### Step 3 — Provider coverage
- **Data-driven, not name-hardcoded:** a per-month **Coverage** checkbox on each provider (`monthly_patterns.coverage`) means that provider both *needs* coverage when out and *can provide* it when in — there's no fixed Steph/Shama exception in code. (The seeded default leaves Steph/Shama unchecked, which is where the "they never need coverage" behavior actually comes from — it's editable, not enforced.)
- For each **coverage-flagged** provider who is out, assign an in-office **coverage-flagged** provider to cover them.
- One coverer may cover **multiple** absent providers; coverers keep their own patients too.
- **Distribution, in order:** (1) fewest providers this coverer is *already covering today* — spreads same-day coverage across people before stacking a second onto anyone; (2) then lowest **running count for the whole month** (not reset weekly — it accumulates across the month); (3) then provider priority rank as the final tie-break.
- Out provider (coverage-flagged) with no eligible coverer in office → **warning**.

### Step 4 — Assign MAs
- Recipients: the **6 providers including RN Steph** (NOT RN Abby, NOT estheticians).
- Each provider: **min 1, max 2** MAs.
- **MA pool** = the MAs (`role === 'ma'`), **minus** the MOD and anyone off. (Keahi/managers are not auto-pooled; assign them manually in the editor.)
- **Fill order:**
  1. **Every working provider gets one MA**, in provider-priority order.
  2. Providers flagged **"2 MAs"** in monthly setup get a **second** MA, in priority order.
  3. Any surplus MAs are **left unassigned** (no even-distribution of extras).
- **MA selection:** prefers an MA whose **default provider** (set in setup) is the one being filled, then an MA not reserved for another working provider.
- **Location constraint (hard):** an MA may only be assigned to a provider at the **same location** that day.
- **Render:** two MA slots per provider; second slot empty if only 1 MA.
- Working provider ends with 0 MAs → **warning**.

### Step 5 — Assign PCCs / Aesthetic Concierge
- Targets needing coverage daily: **6 providers + 2 estheticians + RN Abby** (9 boxes).
- Each PCC covers **1–2** targets as a soft goal but **may exceed 2** when needed.
- **Gap-fill order:** assign the 4 PCCs first; cover any remaining targets with **Aesthetic Concierge (Raella, Maile)** acting as PCC.
- **Location constraint (hard):** a PCC/concierge may only cover a target at the **same location** that day. A target with no same-location coverer is left uncovered → **warning** (`target_no_pcc`). *(Changed from the original soft preference per client request.)* If a covering link ever ends up pointing at a target in a different location (e.g. after regenerating just the target — see §8), that's a separate **warning** (`pcc_location_mismatch`).

### Step 6 — Shipping
- **Auto-assigned during generation**, not purely manual: the person with the lowest **Shipping rank** (`monthly_patterns.shipping_rank`, set in Monthly Setup) who is working **at Kona** gets Shipping for the day. If nobody is ranked/at Kona, that day's **MOD is the fallback**.
- Only one person is auto-assigned this way, but the Editor can add or change Shipping for anyone, any day, in the tile editor — **multiple people may have Shipping** the same day.
- 📦 emoji shows on every person with Shipping that day.

### Step 6.5 — Inventory Day
- **Auto-assigned only on the last weekday of each calendar month** (`src/engine/inventory.ts`'s `isLastWeekdayOfMonth`; walks back over a weekend if the month's actual last day is Sat/Sun). Not tied to holidays specifically — if the last weekday is also a holiday, the day is skipped entirely like any other holiday (no staff, no inventory, no warnings).
- Per **location** (Kona, Waimea) independently: **randomly** picks one working **MA**, and one working **PCC-tier** person — Aesthetic Concierge first, then PCC, then Manager as a last-resort fallback — and flags them `is_inventory`. A location with nobody eligible working gets nothing (no warning either, per below).
- The day's **MOD is excluded** from being picked (either tier) — already committed to a different standalone duty.
- **Additive, not exclusive:** unlike MOD, inventory duty doesn't remove someone from their normal MA/PCC/coverage assignment — it's a flag layered on top.
- **Manually toggleable** any day (not just the last weekday) in the tile editor, for MA/PCC/Aesthetic Concierge/Manager roles — same as Shipping/Social Media.
- Idempotent: if a location already has someone flagged (e.g. a real persisted pick from an earlier generate, or manually set), it's left alone rather than re-picked — same "don't disturb an already-made decision" principle as MOD in independent per-person regenerates (§8).

### Step 7 — Manual specials
- Huaka → **Social Media** (manual toggle).

### Step 8 — Custom text
- Free-text note field on every person, every day.

### Step 9 — Warnings (all dismissible; dismissals persist)
Raise when: no MOD designated (`no_mod`); more than one person flagged MOD the same day (`multiple_mod`); a working provider has 0 or >2 MAs (`provider_no_ma` / `provider_too_many_ma`); a coverage-flagged out provider has no coverage (`out_provider_no_coverage`); an MA's location ≠ their assigned provider's location (`ma_location_mismatch`); a coverage target has no PCC/concierge (`target_no_pcc`); a PCC/concierge's location ≠ a target they're covering (`pcc_location_mismatch`); on the last weekday of the month, a location with working MAs/PCC-tier staff but nobody flagged for inventory (`inventory_ma_missing` / `inventory_pcc_missing`).

---

## 7. Calendar UI

- **Layout:** monthly view, **one week per row**, vertical scroll between weeks. Months render as whole Mon–Fri weeks (see §6), so the last row may spill into the next calendar month.
- Day cells group staff by role; tiles colored by location; MA slots nested under their provider.
- **Holiday** weekdays render as a greyed-out column with a "Holiday" badge and no staff.
- Tiles surface: location color, 📦 shipping, 📣 social media, MOD badge, a brown **INV** badge (Inventory Day, §6 Step 6.5), coverage badge, custom-text indicator, and (for MAs) a `#N` **weekly task** badge. Request-off tiles render pink (see §4). An MA manually flagged **Missed Shift** (tile editor) renders light red instead of their usual location color, overriding it.
- **Weekly MA tasks (`#1–6`):** a deterministic rotation among MAs who work at least one day that week and are not MOD-eligible, keyed by ISO week and recomputed from the roster (`src/engine/weeklyTasks.ts`), so new MAs join automatically. It's **derived, not stored** — but the Editor can override a person's number in the tile editor; the override is persisted per-assignment (`weekly_task_no`) and pinned across that whole week. **Generate month** clears overrides.
- **Editor** can **drag an MA tile onto a provider card** to reassign it (dnd-kit) — that's the only drag-and-drop interaction. Everything else (location, MOD, coverage, PCC targets, shipping, social-media, custom note) is changed by **clicking a tile** to open the `AssignmentEditor` panel. Every drop or edit re-runs validation (§9) and refreshes warnings live. **Viewers** get the same view, read-only.
- **Generate month** rebuilds the whole displayed month from scratch (delete + regenerate) — it first snapshots the current schedule (`schedule_snapshots`), and a **"Revert last Generate"** toolbar button restores that snapshot, undoing the generate including any manual edits it wiped. Only the most recent snapshot per month is kept.
- **Publish / Unpublish** toggle per month (`published_months`): Viewers only see months the Editor has published; an unpublished month shows a "hasn't been published yet" message to Viewers instead of the calendar. Editors always see everything regardless of publish state. This is a UI-only gate — RLS still allows public `SELECT` on the underlying data.
- Use Supabase Realtime so Viewers reflect Editor edits without refreshing.

---

## 8. Monthly setup UI

- A **Holidays** callout at the top: day-of-month ranges like `1, 4-5` (same parser), saved per month to `monthly_holidays`.
- Per person: pick `usual_weekdays` and a location per selected weekday (Kona / Waimea / Remote, or the two-week alternating choices **Kona / Waimea** and **Waimea / Kona**); enter requested time off as ranges like `1-3, 8-11` (parse → expanded `int[]`); enter **Additional days** (same range parser) plus an **Additional days location**; plus per-row defaults/ranks (default provider/target, "2 MAs", coverage, provider/MOD/shipping ranks).
- **Autosave:** every field change persists automatically (debounced) — there's no manual save step. A header status indicator shows "Saving…" / "All changes saved ✓".
- **Per-person "⚡ Generate" button**, one per row, far right of the table: regenerates just that one staff member into the currently-viewed month using the full engine (so cross-person placement — MA→provider, coverage, PCC — stays consistent), but only writes **their own** rows. Everyone else's existing assignments (including manual edits) are left untouched. This is the way to add a newly-hired person into an already-generated month without wiping the rest of the schedule.
- **First month is entered manually.** Later months copy `usual_weekdays` + `location_by_weekday` + defaults/ranks from the prior month via the explicit **Copy last month** button (all editable, saved immediately). `requested_off_days` **and** `additional_days` / `additional_days_location` are month-specific and do **not** carry over.
- **Hide / Unhide month** toggle (`hidden_months`): hidden months are skipped when the Editor's calendar picks a default landing month, without affecting Viewer visibility (that's the separate Publish toggle in §7).
- **Roster page:** add staff, deactivate/reactivate, and **permanently delete** inactive staff (erases their assignments + patterns; clears references from other rows).

---

## 9. Build phases (suggested order)

1. **Scaffold** — Vite + React + TS + Tailwind + React Router; Supabase client; TanStack Query.
2. **DB + auth** — migrations for §5 schema; username/password login; `app_users` + RLS; seed the full roster from §4 with correct flags.
3. **Generation engine** — implement §6 as the pure `/engine` module with **Vitest tests per rule** before any UI wiring.
4. **Monthly setup UI** — §8, including the range parser.
5. **Calendar view** — §7 read path (week rows, colors, badges, emojis).
6. **Drag-and-drop + live validation** — dnd-kit edits → persist → recompute warnings.
7. **Realtime + roles** — live Viewer updates; lock writes to the Editor.
8. **Carry-forward + polish** — next-month auto-population, warning dismissal, manual Social Media / Shipping toggles, custom-text fields.

---

## 10. Notes & assumptions for the implementer

- Keep `/engine` pure and fully tested — it's the core; correctness there matters most.
- Enforce the single-editor rule in the DB via RLS, not only in the UI.
- **Assumptions baked in (flag if any should change):**
  1. MA location must match the assigned provider's location (hard constraint).
  2. PCC/concierge location matching is now a HARD constraint (changed per client request); a target with no same-location coverer is left uncovered and warned.
  3. MOD required only on operating days (Mon–Fri); weekends out of scope.
  4. "Even coverage" = coverage-assignment count per covering provider, balanced first by same-day count then by a running **monthly** count (not reset weekly — see §6 Step 3).
  5. Estheticians and wellness receive no MAs; only the 6 providers do.
  6. MA distribution: one per provider (priority order), a second only for "2 MAs"-flagged providers; surplus MAs are left unassigned (changed per client request — was "Tricia gets 2, then balance evenly").
  7. Months span whole Mon–Fri weeks (week → month-of-its-Monday); trailing days resolve against the next month's patterns.
  8. Holidays (`monthly_holidays`) skip a weekday entirely: no staff, no warnings, greyed out.
  9. `alternating` / `waimea_kona` switch location in **two-week blocks within the month** (resets each month), not by continuous weekly parity.
  10. `additional_days` force a person to work (at `additional_days_location`), overriding usual weekdays and requested-off; neither `additional_days` nor `requested_off_days` carries forward between months.
  11. Weekly MA task `#N` is derived per week; a per-assignment `weekly_task_no` override pins it and is wiped by re-generate.

---

## 11. Working in this repo (commands & current state)

```bash
npm install         # install deps
npm run dev         # Vite dev server at http://localhost:5173
npm test            # run the engine + util test suite once (Vitest)
npm run test:watch  # watch mode
npm run test -- src/engine/__tests__/mod.test.ts   # run a single spec
npm run typecheck   # tsc --noEmit (project references)
npm run build       # tsc -b && vite build
npm run lint        # eslint (flat config)
```

**Environment:** copy `.env.example` → `.env` and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
Login is username + password (the app appends `@drmonicascheel.com`); create the editor's
user in Supabase Auth. Temporarily, any signed-in user is treated as the editor
(`0003_all_editors.sql` / `setup_all.sql`); the original per-`app_role` gating still lives in
`0002_rls.sql`.

**Supabase:** schema/RLS live in `/supabase/migrations` (`0001_schema.sql` … `0017_schedule_snapshots.sql`);
roster is seeded by `/supabase/seed.sql`. `setup_all.sql` is a single idempotent
drop-and-recreate of the whole schema (handy for the dashboard SQL Editor). Apply migrations with
the Supabase CLI (`supabase db push`) — **new columns/tables must be applied to
the DB before their features work** (e.g. `0013` adds `daily_assignments.weekly_task_no`; `0014`
adds `monthly_patterns.additional_days` + `additional_days_location`; `0015`/`0016` add
`published_months` / `hidden_months`; `0017` adds `schedule_snapshots`). Regenerate `src/lib/database.types.ts` with
`supabase gen types typescript` once the project is linked — note that table Row types must be
`type` aliases, not `interface`s, or the typed client silently degrades to `never`.

**Daily backups:** `scripts/backup-db.sh` + a macOS LaunchAgent (`scripts/com.dmsd-schedule.backup.plist`)
export every publicly-readable table to JSON once a day (no `pg_dump`/Docker — that path needs Docker
running, which isn't reliable for an unattended job; see `scripts/README-backups.md`). The *installed*,
launchd-invoked copy lives outside the repo at `~/.dmsd-schedule/backup-db.sh` — launchd cannot read/execute
a script located under `~/Desktop` (macOS TCC blocks it); keep the two in sync by hand if you edit the script.

**Architecture notes specific to this build:**
- Months are computed as whole Mon–Fri weeks via `monthWeekRange`/`weekdayRows`/`monthRange`
  (`src/lib/dates.ts`); `generateMonth` mirrors that range and indexes patterns by calendar month
  so spillover days use the next month's setup. Holidays are passed in as a `Set<string>` of ISO
  dates and skipped during generation; `buildDayModel` greys them in the calendar.
- The engine is data-driven from per-month `monthly_patterns` rows, not hard-coded names: each row
  carries `coverage` (provider both needs + can provide coverage), `wants_two_mas`,
  `default_target_id` (MA→provider / PCC→target), `provider_rank` / `mod_rank` /
  `shipping_rank`, and `additional_days` + `additional_days_location` (force-work override).
  Earlier person-specific staff flags were dropped (`0008`–`0010`).
- `daily_assignments.weekly_task_no` is a nullable per-assignment override for the derived
  weekly `#N` badge; `SchedulePage` overlays it onto the rotation in `weeklyTasksFor` so a value on
  any day of the week pins that MA's number for the whole week (calendar + Excel export).
- `computeWarnings` (`src/engine/warnings.ts`) is the single source of validation — it runs both
  during generation and live after every drag/drop or edit. The UI recomputes warnings from cached
  assignments via `useMonthWarnings`, so manual edits re-validate for free.
- Editing in the calendar happens two ways: drag an MA tile onto a provider card (dnd-kit) to
  reassign, or click any tile to open `AssignmentEditor`, which covers location, MOD, coverage,
  PCC targets, shipping, social-media, and the custom note in one panel.
- `useReplaceMonth` persists only present staff (`location !== 'off'`); off staff are derived from
  the roster in `buildDayModel`. It's a full delete-then-reinsert of the month's `daily_assignments` —
  destructive to manual edits, which is why it snapshots first (see below).
- `useReplacePersonMonth` (Monthly Setup's per-person "⚡ Generate") is the non-destructive counterpart:
  it deletes and reinserts rows scoped to **one `staff_id`** only, leaving every other staff member's
  rows untouched, so a newly-added person can be generated into an already-generated, hand-edited month.
- `schedule_snapshots` + `useScheduleSnapshot`/`useSaveSnapshot` back "Generate month"'s undo: the current
  month's assignments are captured right before the destructive replace, and "Revert last Generate" in
  the toolbar restores that snapshot (one snapshot kept per month, overwritten each generate).
- `published_months` / `hidden_months` are both simple presence-tables (`month` primary key) gating,
  respectively, Viewer visibility (§7) and which month the Editor's calendar defaults to (§8) — independent
  of each other and of RLS, which still allows public `SELECT` on the underlying schedule data either way.
