-- Make the staff table role-only: drop the last person-specific columns.
--   priority_rank -> provider fill order is now per-month (monthly_patterns.provider_rank,
--                    seeded from defaultPatterns). 0007 already backfilled it.
--   in_ma_pool    -> managers are assigned as an MA manually in the editor, never auto-pooled.

alter table staff
  drop column if exists priority_rank,
  drop column if exists in_ma_pool;
