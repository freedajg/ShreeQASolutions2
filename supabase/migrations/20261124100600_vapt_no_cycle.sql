-- Client answer (DECISIONS 22-Nov-2026): VAPT has no fixed cycle; SQAS enters its dates.
-- The lookups migration gave it 12 months. With no cycle, a VAPT engagement without a date
-- stays off the Renewal Radar instead of showing an estimated date (PRD FR-4 rule 4).
-- CMMC keeps 36 months until the client confirms its cycle (asked 22-Nov-2026).
update public.certification_types
set surveillance_months = null, recert_months = null
where code = 'VAPT';
