-- client-portal-facets was aggregating distinct-value counts in JS after a
-- plain `select(field)` with no pagination -- PostgREST caps unpaginated
-- selects at 1000 rows, so on a ~100k-row applicants table every facet count
-- was silently computed from only the first 1000 matching rows instead of
-- the whole pool. This RPC does the aggregation in a single GROUP BY query
-- instead, so counts are always exact regardless of table size.
CREATE OR REPLACE FUNCTION public.client_portal_facet_counts(p_field text, p_filters jsonb)
RETURNS TABLE(value text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_fields text[] := ARRAY[
    'nationality', 'desired_position', 'preferred_city', 'current_city', 'gender',
    'marital_status', 'education_level', 'major', 'university', 'job_type',
    'years_experience', 'current_title', 'currently_employed', 'has_transport',
    'arabic_level', 'english_level', 'hear_about', 'source', 'source_company'
  ];
  where_sql text := 'is_archived = false';
  field_group record;
  or_parts text[];
  v text;
BEGIN
  IF NOT (p_field = ANY(allowed_fields)) THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;

  -- Group the OTHER active filters by field -- OR within the same field,
  -- AND across different fields -- mirroring applyFieldFilters() in the
  -- client-search-applicants/client-portal-facets edge functions. %I/%L
  -- quote the identifier/literal safely; p_field itself is already
  -- allow-list-checked above before ever reaching format().
  FOR field_group IN
    SELECT (elem->>'field') AS fld, array_agg(elem->>'value') AS vals
    FROM jsonb_array_elements(p_filters) elem
    WHERE (elem->>'field') = ANY(allowed_fields) AND (elem->>'field') <> p_field
    GROUP BY (elem->>'field')
  LOOP
    or_parts := ARRAY[]::text[];
    FOREACH v IN ARRAY field_group.vals LOOP
      or_parts := array_append(or_parts, format('%I ILIKE %L', field_group.fld, '%' || v || '%'));
    END LOOP;
    IF array_length(or_parts, 1) > 0 THEN
      where_sql := where_sql || ' AND (' || array_to_string(or_parts, ' OR ') || ')';
    END IF;
  END LOOP;

  where_sql := where_sql || format(' AND %I IS NOT NULL', p_field);

  RETURN QUERY EXECUTE format(
    'SELECT %I::text AS value, count(*)::bigint AS count FROM public.applicants WHERE %s GROUP BY %I ORDER BY count DESC LIMIT 500',
    p_field, where_sql, p_field
  );
END;
$$;

REVOKE ALL ON FUNCTION public.client_portal_facet_counts(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_facet_counts(text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
