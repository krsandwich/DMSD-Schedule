-- Add the 'intern' role. Interns need only standard attendance (weekday /
-- location / time-off) plus which MA they shadow this month — reusing
-- monthly_patterns.default_target_id (already a generic "preferred pairing"
-- field: MA -> provider, PCC -> target, and now Intern -> the MA they
-- shadow) rather than adding a new column. No defaults/ranks apply to them.

alter type role add value if not exists 'intern';
