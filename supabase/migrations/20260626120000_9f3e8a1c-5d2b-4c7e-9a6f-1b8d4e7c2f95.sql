-- System Health monitoring: a client/query/mutation error log so failures are
-- visible somewhere other than the browser console, plus three read-only
-- introspection functions (DB size, per-bucket storage size, biggest tables)
-- that back a new admin-only "System Health" dashboard tab. These functions
-- are only ever called by the system-health edge function via the
-- service-role key (same pattern as get_backup_table_names()) - the edge
-- function does its own admin check before calling them, exactly like
-- manage-user does for its actions.

CREATE TABLE IF NOT EXISTS public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  source text NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'query', 'mutation', 'edge_function')),
  message text NOT NULL,
  stack text,
  context jsonb,
  url text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view error_log" ON public.error_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert own error events" ON public.error_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anon can insert anonymous error events" ON public.error_log
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_error_log_created ON public.error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_severity ON public.error_log (severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_database_size(current_database());
$$;

REVOKE ALL ON FUNCTION public.get_db_size() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_db_size() TO service_role;

CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS TABLE(bucket_id text, object_count bigint, total_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.bucket_id,
    count(*)::bigint AS object_count,
    coalesce(sum((o.metadata ->> 'size')::bigint), 0) AS total_bytes
  FROM storage.objects o
  GROUP BY o.bucket_id
  ORDER BY total_bytes DESC;
$$;

REVOKE ALL ON FUNCTION public.get_storage_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO service_role;

CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, total_bytes bigint, row_estimate bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text AS table_name,
    pg_total_relation_size(c.oid)::bigint AS total_bytes,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY total_bytes DESC
  LIMIT 15;
$$;

REVOKE ALL ON FUNCTION public.get_table_sizes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO service_role;

NOTIFY pgrst, 'reload schema';
