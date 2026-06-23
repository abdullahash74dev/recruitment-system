-- Hardens the system backup feature so it can no longer silently miss data:
--
-- 1) get_backup_table_names(): the backup edge function used to back up a
--    hardcoded list of 23 tables. The schema has since grown to 36+ tables
--    (audit_log, deleted_items, notifications, app_secrets, ai_*, ...) that
--    were never added to that list and were therefore never backed up. This
--    function lets the backup job discover every table in `public` at
--    runtime, so a future new table is always included automatically.
--
-- 2) restore_from_backup(): restores one or more tables from a JSON
--    snapshot produced by the backup job, in either:
--      - 'merge'   : upsert by primary key, never deletes a row that isn't
--                    in the snapshot (safe, additive).
--      - 'replace' : wipes each named table back to exactly what's in the
--                    snapshot (destructive, exact point-in-time restore).
--    Runs as a single transaction per call (PostgREST wraps each RPC call
--    in one transaction) so a failure partway through rolls back cleanly
--    with no partial state. Foreign-key/trigger checks are suspended for
--    the duration of each table's load (so 'replace' can freely
--    delete+reinsert rows that reference each other) and restored before
--    the function returns. Every table name is validated against
--    get_backup_table_names() first and applied via format('%I', ...) to
--    rule out SQL injection through a crafted snapshot payload.

CREATE OR REPLACE FUNCTION public.get_backup_table_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(table_name ORDER BY table_name), ARRAY[]::text[])
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
$$;

REVOKE ALL ON FUNCTION public.get_backup_table_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_backup_table_names() TO service_role;

CREATE OR REPLACE FUNCTION public.restore_from_backup(_tables jsonb, _mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valid_tables text[];
  _tbl text;
  _pk_cols text[];
  _set_clause text;
  _row_count integer;
  _summary jsonb := '{}'::jsonb;
  _temp_table text;
BEGIN
  IF _mode NOT IN ('merge', 'replace') THEN
    RAISE EXCEPTION 'Invalid restore mode: %', _mode;
  END IF;

  SELECT public.get_backup_table_names() INTO _valid_tables;

  FOR _tbl IN SELECT jsonb_object_keys(_tables)
  LOOP
    IF NOT (_tbl = ANY(_valid_tables)) THEN
      RAISE EXCEPTION 'Unknown table in restore payload: %', _tbl;
    END IF;
  END LOOP;

  FOR _tbl IN SELECT jsonb_object_keys(_tables)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER ALL', _tbl);

    IF _mode = 'replace' THEN
      EXECUTE format('DELETE FROM public.%I', _tbl);
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)',
        _tbl, _tbl
      ) USING (_tables -> _tbl);
      GET DIAGNOSTICS _row_count = ROW_COUNT;
    ELSE
      -- merge: upsert by primary key so existing rows not present in the
      -- snapshot are left untouched. Tables with no single-key primary key
      -- fall back to a plain insert (can duplicate rows on repeated merge
      -- restores of the same snapshot - acceptable for the handful of
      -- append-only log tables without a PK; every other table in this
      -- schema has a uuid primary key).
      SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position)
      INTO _pk_cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = _tbl AND tc.constraint_type = 'PRIMARY KEY';

      _temp_table := 'tmp_restore_' || _tbl;
      EXECUTE format('CREATE TEMP TABLE %I (LIKE public.%I) ON COMMIT DROP', _temp_table, _tbl);
      EXECUTE format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)',
        _temp_table, _tbl
      ) USING (_tables -> _tbl);

      IF _pk_cols IS NOT NULL THEN
        SELECT string_agg(format('%I = EXCLUDED.%I', c.column_name, c.column_name), ', ')
        INTO _set_clause
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = _tbl
          AND c.column_name <> ALL(_pk_cols);

        IF _set_clause IS NOT NULL THEN
          EXECUTE format(
            'INSERT INTO public.%I SELECT * FROM %I ON CONFLICT (%s) DO UPDATE SET %s',
            _tbl, _temp_table, array_to_string(_pk_cols, ', '), _set_clause
          );
        ELSE
          EXECUTE format(
            'INSERT INTO public.%I SELECT * FROM %I ON CONFLICT (%s) DO NOTHING',
            _tbl, _temp_table, array_to_string(_pk_cols, ', ')
          );
        END IF;
      ELSE
        EXECUTE format('INSERT INTO public.%I SELECT * FROM %I', _tbl, _temp_table);
      END IF;

      EXECUTE format('SELECT count(*) FROM %I', _temp_table) INTO _row_count;
      EXECUTE format('DROP TABLE IF EXISTS %I', _temp_table);
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER ALL', _tbl);

    _summary := _summary || jsonb_build_object(_tbl, _row_count);
  END LOOP;

  RETURN _summary;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_from_backup(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_from_backup(jsonb, text) TO service_role;

-- backup_runs: track the file-backup side (storage buckets) alongside the
-- existing table row-backup side, and the snapshot's storage folder so a
-- restore can locate both the data JSON and the copied files together.
ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS buckets_summary jsonb,
  ADD COLUMN IF NOT EXISTS backup_folder text,
  ADD COLUMN IF NOT EXISTS integrity_ok boolean;

-- restore_runs: audit trail of every restore attempt (mirrors backup_runs).
CREATE TABLE IF NOT EXISTS public.restore_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'success',
  source_backup_path text,
  mode text NOT NULL,
  tables_restored jsonb,
  files_restored integer,
  pre_restore_safety_backup_path text,
  error_message text,
  triggered_by_user uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restore_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view restore_runs" ON public.restore_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert restore_runs" ON public.restore_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_restore_runs_created ON public.restore_runs (created_at DESC);

NOTIFY pgrst, 'reload schema';
