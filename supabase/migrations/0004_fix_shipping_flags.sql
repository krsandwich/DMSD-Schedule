-- Fix seed bug: PCC and Aesthetic Concierge rows had can_shipping = false
-- (the can_pcc / can_shipping / can_social_media columns were misaligned in the
-- original seed). PCCs and concierge handle shipping, so can_shipping must be true.
-- Run this once to correct an already-seeded database without wiping it.

update staff
   set can_shipping = true,
       can_pcc = false
 where role = 'pcc';

update staff
   set can_shipping = true,
       can_pcc = true,
       can_social_media = false
 where role = 'aesthetic_concierge';
