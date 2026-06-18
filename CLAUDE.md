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
| `off` (Off / R/O = Request Off) | Light grey |

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

**MOD eligibility & priority:** Keahi (default) → Sara → Reina.

---

## 5. Data model (Postgres / Supabase)

Create via Supabase CLI migrations. Suggested schema — adapt naming as needed but preserve the relationships.

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
```

**Weekly coverage counter** (for even coverage distribution) is **derived** — compute from `provider_coverage_ids` over the current week rather than storing it.

### Auth / RLS
- Login via Supabase email/password. The Editor types a **username**; the app appends `@drmonicascheel.com` and signs in. On first login, an `app_users` row is inserted; the Editor is promoted manually (seed/admin).
- Helper: `is_editor()` returns true when the user is signed in (temporarily simplified — see `0003_all_editors.sql` / `setup_all.sql`; originally `app_role = 'editor'`).
- RLS on `staff`, `monthly_patterns`, `monthly_holidays`, `daily_assignments`, `dismissed_warnings`: **publicly readable (`SELECT`, incl. logged-out viewers); only `is_editor()` may `INSERT/UPDATE/DELETE`.**

---

## 6. Generation algorithm

Run per weekday (Mon–Fri). A person **works** that day if it's one of their `usual_weekdays` and the day-of-month is not in `requested_off_days`. Everyone working gets their location from `location_by_weekday`; non-working people render `off` (grey). Steps run in order — later steps depend on earlier ones.

**Month = whole weeks.** A month is generated and displayed as complete Mon–Fri weeks: a week belongs to the month containing its **Monday**, so a month spans from its first Monday through the Friday of the week containing its last Monday (e.g. June 2026 = Jun 1 → Jul 3, July 2026 = Jul 6 → Jul 31; adjacent months never overlap or leave a gap). Trailing spillover days resolve against the **next** calendar month's patterns, so generation pulls both months' patterns.

**Holidays.** Days listed in `monthly_holidays` are skipped entirely — no staff are scheduled, no warnings are raised, and the calendar greys the day out.

### Step 1 — Attendance & locations
Resolve present/off for each staff member and set each present person's location. (Holiday weekdays are skipped before this step.)

### Step 2 — MOD (exactly one per day)
- Choose the highest-priority **working** MOD-eligible person: Keahi → Sara → Reina.
- MOD is **standalone**: remove that person from the MA pool; they are not placed under any provider.
- If none is working → **warning** (a MOD must always exist).

### Step 3 — Provider coverage
- For each provider who is **OUT**, designate an in-office provider to cover their patients — **except RN Steph and Dr. Shama, who never need coverage when out.**
- **Eligible coverers:** any in-office provider **except RN Steph**. Dr. Shama may cover.
- One coverer may cover **multiple** absent providers; coverers keep their own patients too.
- **Even distribution:** track each eligible coverer's coverage count for the current week; assign new coverage to the coverer with the **lowest weekly count** (tie-break by provider priority order). **Reset every Monday.**
- Out provider with no eligible coverer in office → **warning**.

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
- **Location constraint (hard):** a PCC/concierge may only cover a target at the **same location** that day. A target with no same-location coverer is left uncovered → **warning**. *(Changed from the original soft preference per client request.)*

### Step 6 — Shipping
- Per-day **Shipping checkbox** on each PCC and each Aesthetic Concierge.
- **Multiple people may have Shipping** the same day.
- Checked → 📦 emoji on that person's tile.

### Step 7 — Manual specials
- Huaka → **Social Media** (manual toggle).

### Step 8 — Custom text
- Free-text note field on every person, every day.

### Step 9 — Warnings (all dismissible; dismissals persist)
Raise when: no MOD designated; a working provider has 0 (or >2) MAs; an out provider (other than Steph/Shama) has no coverage; an MA's location ≠ assigned provider's location; a coverage target has no PCC/concierge.

---

## 7. Calendar UI

- **Layout:** monthly view, **one week per row**, vertical scroll between weeks. Months render as whole Mon–Fri weeks (see §6), so the last row may spill into the next calendar month.
- Day cells group staff by role; tiles colored by location; MA slots nested under their provider.
- **Holiday** weekdays render as a greyed-out column with a "Holiday" badge and no staff.
- Tiles surface: location color, 📦 shipping, MOD badge, coverage badge, custom-text indicator.
- **Editor** can drag-and-drop to reassign across providers/locations/MOD/coverage/PCC targets; every drop re-runs validation (§9) and refreshes warnings live. **Viewers** get the same view, read-only.
- Use Supabase Realtime so Viewers reflect Editor edits without refreshing.

---

## 8. Monthly setup UI

- A **Holidays** callout at the top: day-of-month ranges like `1, 4-5` (same parser), saved per month to `monthly_holidays`.
- Per person: pick `usual_weekdays` and a location per selected weekday; enter requested time off as ranges like `1-3, 8-11` (parse → expanded `int[]`); plus per-row defaults/ranks (default provider/target, "2 MAs", coverage, provider/MOD/shipping ranks).
- **First month is entered manually.** Each later month auto-populates `usual_weekdays` + `location_by_weekday` from the prior month (editable); `requested_off_days` does **not** carry over.
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
  4. "Even coverage" = coverage-assignment count per covering provider per week, reset Monday.
  5. Estheticians and wellness receive no MAs; only the 6 providers do.
  6. MA distribution: one per provider (priority order), a second only for "2 MAs"-flagged providers; surplus MAs are left unassigned (changed per client request — was "Tricia gets 2, then balance evenly").
  7. Months span whole Mon–Fri weeks (week → month-of-its-Monday); trailing days resolve against the next month's patterns.
  8. Holidays (`monthly_holidays`) skip a weekday entirely: no staff, no warnings, greyed out.

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

**Supabase:** schema/RLS live in `/supabase/migrations` (`0001_schema.sql` … `0012_holidays.sql`);
roster is seeded by `/supabase/seed.sql`. `setup_all.sql` is a single idempotent
drop-and-recreate of the whole schema (handy for the dashboard SQL Editor). Apply migrations with
the Supabase CLI (`supabase db push`) — **new tables (e.g. `monthly_holidays`) must be applied to
the DB before their features work.** Regenerate `src/lib/database.types.ts` with
`supabase gen types typescript` once the project is linked — note that table Row types must be
`type` aliases, not `interface`s, or the typed client silently degrades to `never`.

**Architecture notes specific to this build:**
- Months are computed as whole Mon–Fri weeks via `monthWeekRange`/`weekdayRows`/`monthRange`
  (`src/lib/dates.ts`); `generateMonth` mirrors that range and indexes patterns by calendar month
  so spillover days use the next month's setup. Holidays are passed in as a `Set<string>` of ISO
  dates and skipped during generation; `buildDayModel` greys them in the calendar.
- The engine is data-driven from per-month `monthly_patterns` rows, not hard-coded names: each row
  carries `coverage` (provider both needs + can provide coverage), `wants_two_mas`,
  `default_target_id` (MA→provider / PCC→target), and `provider_rank` / `mod_rank` /
  `shipping_rank`. Earlier person-specific staff flags were dropped (`0008`–`0010`).
- `computeWarnings` (`src/engine/warnings.ts`) is the single source of validation — it runs both
  during generation and live after every drag/drop or edit. The UI recomputes warnings from cached
  assignments via `useMonthWarnings`, so manual edits re-validate for free.
- Editing in the calendar happens two ways: drag an MA tile onto a provider card (dnd-kit) to
  reassign, or click any tile to open `AssignmentEditor`, which covers location, MOD, coverage,
  PCC targets, shipping, social-media, and the custom note in one panel.
- `useReplaceMonth` persists only present staff (`location !== 'off'`); off staff are derived from
  the roster in `buildDayModel`.
