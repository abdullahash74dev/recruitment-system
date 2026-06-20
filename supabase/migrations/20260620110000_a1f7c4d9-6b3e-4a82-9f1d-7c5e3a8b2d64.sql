-- The background applicant loader pages through the whole table ordered by created_at
-- (dozens of range() requests as the table has grown past 60k rows). With no index backing
-- that ORDER BY, every single page request forces Postgres to sort the entire table from
-- scratch, and running several of those sorts concurrently is what was tripping
-- "canceling statement due to statement timeout". A matching index turns each page into a
-- cheap index scan instead.
CREATE INDEX IF NOT EXISTS idx_applicants_created_at ON public.applicants (created_at DESC);
