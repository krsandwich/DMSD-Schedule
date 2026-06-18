-- Remove staff flags that are now driven per-month in monthly_patterns, or are
-- otherwise unused:
--   mod_priority            -> mod_rank (monthly setup)
--   can_shipping            -> shipping_rank (monthly setup)
--   can_social_media        -> all MAs can do social media (role check)
--   needs_coverage_when_out -> coverage flag (monthly setup)
--   can_cover_providers     -> coverage flag (monthly setup)

-- No remote employee can act as a PCC.
update staff set can_pcc = false where role = 'remote';

alter table staff
  drop column if exists mod_priority,
  drop column if exists can_social_media,
  drop column if exists can_shipping,
  drop column if exists needs_coverage_when_out,
  drop column if exists can_cover_providers;
