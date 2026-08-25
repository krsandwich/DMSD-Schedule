-- Inventory Day: on the last weekday of each month, one MA and one PCC-tier
-- person (aesthetic concierge -> PCC -> manager fallback) are randomly picked
-- per location (Kona/Waimea) to handle inventory. Manually toggleable per
-- person per day in the tile editor, like Shipping/Social Media.

alter table daily_assignments
  add column if not exists is_inventory boolean not null default false;
