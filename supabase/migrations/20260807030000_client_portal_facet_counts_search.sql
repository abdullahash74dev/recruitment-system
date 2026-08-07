-- client_portal_facet_counts computed distinct-value counts scoped by the
-- currently-applied FILTER chips, but ignored the free-text search box
-- entirely. So a client who searched "تسويق سعودي دمام" (203 matching
-- results) and then opened e.g. "Years of Experience" saw counts summing to
-- the whole ~100k-applicant pool instead of just their 203 matches. Extend
-- the function to also apply the same search-term matching
-- client-search-applicants uses (8 columns, any/all-words modes), so facet
-- counts always reflect exactly what's currently on screen.
DROP FUNCTION IF EXISTS public.client_portal_facet_counts(text, jsonb);

CREATE OR REPLACE FUNCTION public.client_portal_facet_counts(
  p_field text,
  p_filters jsonb,
  p_search text DEFAULT NULL,
  p_search_mode text DEFAULT 'any'
)
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
  -- Same 8 columns client-search-applicants' SEARCH_COLUMNS uses.
  search_columns text[] := ARRAY[
    'full_name', 'desired_position', 'current_title', 'major',
    'university', 'nationality', 'current_city', 'preferred_city'
  ];
  where_sql text := 'is_archived = false';
  field_group record;
  or_parts text[];
  v text;
  word text;
  col text;
  words text[];
BEGIN
  IF NOT (p_field = ANY(allowed_fields)) THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;

  -- Group the OTHER active filter chips by field -- OR within the same
  -- field, AND across different fields.
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

  -- Free-text search, same any/all-words semantics as client-search-applicants.
  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    words := regexp_split_to_array(btrim(p_search), '\s+');
    IF p_search_mode = 'all' THEN
      FOREACH word IN ARRAY words LOOP
        IF btrim(word) = '' THEN CONTINUE; END IF;
        or_parts := ARRAY[]::text[];
        FOREACH col IN ARRAY search_columns LOOP
          or_parts := array_append(or_parts, format('%I ILIKE %L', col, '%' || word || '%'));
        END LOOP;
        where_sql := where_sql || ' AND (' || array_to_string(or_parts, ' OR ') || ')';
      END LOOP;
    ELSE
      or_parts := ARRAY[]::text[];
      FOREACH word IN ARRAY words LOOP
        IF btrim(word) = '' THEN CONTINUE; END IF;
        FOREACH col IN ARRAY search_columns LOOP
          or_parts := array_append(or_parts, format('%I ILIKE %L', col, '%' || word || '%'));
        END LOOP;
      END LOOP;
      IF array_length(or_parts, 1) > 0 THEN
        where_sql := where_sql || ' AND (' || array_to_string(or_parts, ' OR ') || ')';
      END IF;
    END IF;
  END IF;

  where_sql := where_sql || format(' AND %I IS NOT NULL', p_field);

  RETURN QUERY EXECUTE format(
    'SELECT %I::text AS value, count(*)::bigint AS count FROM public.applicants WHERE %s GROUP BY %I ORDER BY count DESC LIMIT 500',
    p_field, where_sql, p_field
  );
END;
$$;

REVOKE ALL ON FUNCTION public.client_portal_facet_counts(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_facet_counts(text, jsonb, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
