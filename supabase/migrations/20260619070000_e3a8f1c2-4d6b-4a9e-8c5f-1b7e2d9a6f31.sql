-- The migration that added applicants.extra_fields (20260619050000) forgot the
-- PostgREST cache-reload notification, so the column existed in Postgres but the
-- REST API kept rejecting every insert/update that referenced it with
-- "Could not find the 'extra_fields' column ... in the schema cache" -- breaking
-- imports for any row with at least one mapped custom field.
NOTIFY pgrst, 'reload schema';
