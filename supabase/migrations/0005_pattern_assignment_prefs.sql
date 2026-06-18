-- Monthly-setup assignment preferences & ranks.
--   default_target_id : MA -> default provider; PCC -> default coverage target.
--   is_float          : MA only — float MA, placed last to fill gaps.
--   mod_rank          : MOD rank (1 = highest); highest-ranked working person is MOD.
--   shipping_rank     : Shipping rank (1 = highest); highest-ranked working person ships.

alter table monthly_patterns
  add column if not exists default_target_id uuid references staff(id) on delete set null,
  add column if not exists is_float          boolean not null default false,
  add column if not exists mod_rank          int,
  add column if not exists shipping_rank     int;
