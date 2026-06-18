-- Remove the MA "float" option. An MA with no default provider is simply
-- distributed evenly to whoever needs an MA after defaults are assigned.

alter table monthly_patterns
  drop column if exists is_float;
