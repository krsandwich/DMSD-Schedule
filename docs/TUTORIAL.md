# DMSD Scheduler — User Tutorial

A complete guide to using the dermatology office scheduling app: setting up a
month, generating the staff calendar, adjusting it, and sharing it.

> The office runs **Monday–Friday only**. Weekends never appear.

---

## 1. The big picture

There are two kinds of people who use the app:

| Role | What they can do |
|---|---|
| **Editor** | Set monthly patterns, generate the calendar, drag/edit assignments, manage the roster. The practice has **one** editor. |
| **Viewer** | See the live calendar, page between months, and export to Excel — but cannot change anything. No sign-in required. |

The badge in the top-right corner always tells you which mode you're in:
a green **Editor** chip or a grey **Viewer** chip.

**How a schedule gets made, start to finish:**

1. The Editor fills in **Monthly Setup** — who works which weekdays, where, time
   off, and holidays.
2. The Editor clicks **Generate month** — the app auto-builds every day using the
   staffing rules (MOD, coverage, MAs, PCCs, shipping).
3. The Editor **drags and clicks** tiles to fine-tune anything the rules got
   wrong, watching the warning flags.
4. Viewers see the result live and can **Export Excel** for printing/sharing.

---

## 2. Signing in (Editor only)

1. Click **Sign in** (top-right of the calendar).
2. Enter your **username** and **password**. You only type the username — the app
   automatically adds `@drmonicascheel.com` for you.
3. Once signed in, the editing buttons (**Roster**, **Monthly setup**,
   **Generate month**) appear and the badge turns green.

Click **Sign out** anytime to drop back to read-only Viewer mode.
Viewers do **not** need to sign in — just open the site.

---

## 3. Reading the calendar

The calendar shows **one week per row**, scrolling down through the month. Each
day is a column; staff are grouped into rows by role (Providers, Medical
Assistants, PCC, Esthetician, Wellness, Aesthetic Concierge, Manager, Remote
Team, Off, Request Off).

### Location colors

Every tile is colored by where that person is that day. The color key is shown in
the top bar:

- 🟣 **Kona** (purple)
- 🔵 **Waimea** (blue)
- 🟢 **Remote** (green)
- ⚪ **Off / R-O** (grey) — not working, or requested off

### Tile badges

A staff tile can show small markers on the right:

- **MOD** — Manager on Duty for that day.
- 📦 — handling **Shipping**.
- 📣 — assigned to **Social Media**.
- 🔄 *Name(s)* — who this person **covers** (an absent provider they're covering,
  or the targets a PCC/concierge is coordinating).
- 🖊️ *text* — a **custom note** was added for that day (also shown in red).

### Medical Assistants

MAs are **nested under their provider** — each provider card has up to two MA
slots beneath it. An empty dashed "MA 2" box means that provider only has one MA.

### Warnings

If something looks wrong on a day, an amber **⚠ N** chip appears in that day's
header, with a list of issues underneath (see the [Warnings reference](#8-warnings-reference)).

### Holidays

A holiday weekday shows as a **greyed-out column** with a **Holiday** badge and no
staff — the office is closed that day.

---

## 4. The monthly workflow (recommended order)

Each month, the Editor does this:

1. **Monthly setup** → set patterns, time off, and holidays → **Save all**.
2. Back on the calendar, pick the month with the **‹ ›** arrows.
3. Click **Generate month**.
4. Review warnings and **adjust by hand** as needed.
5. **Export Excel** if you want a printable copy.

The next sections cover each step in detail.

---

## 5. Monthly Setup

Click **Monthly setup** (Editor only). Use the **‹ Month ›** arrows at the top to
choose which month you're editing.

### Holidays (top callout)

The amber **Holidays** box at the top takes a day-of-month list like `1, 4-5`
(same format as time off). Any weekday you list is treated as **office closed** —
no staff scheduled, greyed out on the calendar. Leave it blank for none.

### Per-person rows

The table has one row per staff member, grouped by role:

- **Mon–Fri columns** — choose each person's location for that weekday:
  - **—** = not working that day
  - **Kona**, **Waimea**, **Remote**
  - **Kona / Waimea (alternating)** — switches between Kona and Waimea week to
    week automatically.
- **Requested off** — time-off days as ranges, e.g. `1-3, 8-11`.
- **Defaults & ranks** — extra controls depending on role:
  - **Providers:** *Priority #* (MA-fill / tie-break order), **2 MAs** (this
    provider should get a second MA), **Coverage** (this provider both needs
    coverage when out and can cover others when in).
  - **MAs & support roles:** a default **Provider/target** (preferred pairing),
    plus **MOD #** and **📦 #** ranks (lower number = picked first).

### Carry forward

Click **Carry forward** to copy the **previous month's** weekday patterns,
locations, defaults, and ranks into this month (all still editable). **Requested
time off does _not_ carry over** — you re-enter it each month.

### Save

Click **Save all** to store everything (patterns + holidays) for the month.
A status message confirms the save.

> **Tip:** The very first month is entered by hand. After that, **Carry forward**
> saves most of the typing.

---

## 6. Generating the month

On the calendar, with the right month selected, click **Generate month**. The app
builds every weekday using these rules, in order:

1. **Attendance & locations** — who's in, and where (holidays skipped entirely).
2. **MOD** — exactly one Manager on Duty per day (priority **Keahi → Sara →
   Reina**). The MOD is standalone and not given MAs.
3. **Provider coverage** — for each absent provider who needs it, an in-office
   provider is assigned to cover, spread evenly.
4. **Assign MAs** — every working provider gets **one** MA (in priority order),
   then providers flagged **"2 MAs"** get a **second**. Extra MAs are left
   unassigned. An MA can only go to a provider at the **same location**.
5. **Assign PCCs / Aesthetic Concierge** — the 4 PCCs cover the providers,
   estheticians, and wellness; concierge fill any gaps. Coverage must be
   **same-location**.
6. **Shipping** — assigned from the 📦 ranks.

> **Re-generating replaces the whole month.** Generate is destructive for that
> month — it wipes the current days and rebuilds them, so any by-hand edits for
> that month are lost. Set up first, generate once, then fine-tune by hand.

---

## 7. Adjusting the calendar by hand (Editor)

After generating, you can tweak anything. Validation re-runs instantly after
every change, so warnings stay current.

### Drag an MA to a different provider

Grab an **MA tile** and drop it onto another **provider card**. The MA moves to
that provider (and takes the next open slot). Great for quick re-balancing.

### Click any tile to open the editor

Click a tile to open the **side panel**, which shows everything for that person on
that day:

- **Location** — Kona / Waimea / Remote / Off.
- **Manager on Duty (MOD)** — toggle (MAs, managers, support roles).
- **Assigned provider** — for MAs (and managers acting as an MA); choose the
  provider or **— Unassigned —**.
- **Coverage (absent providers)** — for coverage-flagged providers, check which
  absent providers they cover.
- **PCC covers** — for PCC/concierge, check which targets they coordinate.
- **Shipping 📦** — toggle.
- **Social Media 📣** — toggle (MAs).
- **Custom note** — free text (shows on the tile in red with a 🖊️).

Click **Save** to apply, or **Cancel** to discard. Click outside the panel or the
✕ to close.

---

## 8. Warnings reference

Warnings are advisory — they flag likely problems but never block you. They're
recomputed live and can be dismissed (click the ✕ next to a warning; the dismissal
is remembered).

| Warning | Meaning |
|---|---|
| **No MOD** | No Manager on Duty is designated that day. |
| **Provider has 0 MAs** | A working provider ended up with no MA. |
| **Provider has too many MAs** | A provider has more than 2 MAs. |
| **Out provider has no coverage** | An absent provider (who needs coverage) has nobody covering. |
| **MA location mismatch** | An MA is under a provider at a different location. |
| **Target has no PCC coverage** | A provider/esthetician/wellness has no same-location PCC. |

Fix a warning by editing the relevant tiles (reassign, change location, add
coverage, etc.) or dismiss it if it's acceptable.

---

## 9. Managing the roster (Editor)

Click **Roster** to manage staff.

- **Add a person** — type a name, pick a role, click **+ Add person**. Capability
  flags (receives MAs, can PCC, etc.) are set automatically from the role.
- **Deactivate** — removes someone from future schedules but keeps their history.
- **Show inactive** — toggle (top-right) to reveal deactivated people.
- For an inactive person you then get two options:
  - **Reactivate** — bring them back into scheduling.
  - **Delete** — **permanently** remove the person *and all of their schedule
    history*. You'll be asked to confirm; this cannot be undone.

> Deactivate is the safe, reversible choice. Only **Delete** when you're sure you
> never need that person's past schedule again.

---

## 10. Exporting to Excel

Click **Export Excel** (available to anyone, including Viewers). You get an
`.xlsx` of the current month laid out like the calendar — weeks across the top,
staff down the side, each cell colored by location and showing MOD / 📦 / provider
/ notes. Useful for printing or emailing.

---

## 11. Months and full weeks

The calendar always shows **whole Monday–Friday weeks**, so a month can spill a
few days into the next one to finish the last week. A week belongs to the month
that contains its **Monday**. For example:

- **June 2026** = **Jun 1 → Jul 3**
- **July 2026** = **Jul 6 → Jul 31**

Adjacent months never overlap and never leave a gap. When you set up a month, the
trailing spillover days use the **next** month's patterns — so for June's view to
be fully correct through Jul 3, make sure July's setup is done too (or just
re-generate June after setting up July).

Use the **‹ ›** arrows in the top bar to move between months.

---

## 12. Troubleshooting

**"No schedule generated for this month yet."**
Nobody has generated this month. As Editor, set up the month and click **Generate
month**.

**Everyone shows as Off / nothing generates.**
That month's **Monthly Setup** is empty (or weekdays are all "—"). Fill in the
patterns and save, then generate.

**Trailing days (e.g. Jul 1–3 in June) look wrong.**
Those days follow **next month's** setup. Complete July's setup, then re-generate
June.

**A whole day is greyed with a "Holiday" badge.**
That day is listed as a holiday in Monthly Setup. Remove it from the Holidays box
and re-generate if that's a mistake.

**Saving holidays fails with a "table not found" error.**
The `monthly_holidays` table hasn't been created in the database yet — an admin
needs to apply it (see the project README / `supabase/migrations`).

**I can't see the editing buttons.**
You're in Viewer mode. Click **Sign in** with the editor account.

**My by-hand edits disappeared.**
Someone clicked **Generate month**, which rebuilds the whole month from scratch.
Re-do the edits, or set up the patterns so generation produces them automatically.
