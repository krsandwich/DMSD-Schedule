# DMSD-Schedule

Internal scheduling app for a dermatology practice with three locations (Kona, Waimea, Remote).
One Editor sets monthly work patterns and time off; the app auto-generates a month of Mon–Fri
staffing and the Editor drags-and-drops to adjust. Multiple Viewers see a live, read-only calendar.

See **[CLAUDE.md](./CLAUDE.md)** for the full spec, architecture, and commands.

## Quick start

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Layout

- `src/engine/` — pure, framework-free generation engine (the core), unit-tested per rule.
- `src/lib/` — Supabase client, TanStack Query, DB↔engine mappers, date/location helpers.
- `src/hooks/` — auth/session, data queries, mutations, realtime.
- `src/components/`, `src/pages/` — calendar, monthly setup, login.
- `supabase/` — migrations (schema + RLS) and roster seed.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Vitest engine/util suite |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
