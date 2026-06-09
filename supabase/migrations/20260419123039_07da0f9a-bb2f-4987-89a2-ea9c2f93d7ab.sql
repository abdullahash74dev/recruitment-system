-- ============================================
-- SYSTEM AUDIT LOG + DELETED ITEMS TRASH
-- ============================================

-- 1) audit_log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL, -- INSERT | UPDATE | DELETE | LOGIN | LOGOUT | LOGIN_FAILED | RESTORE | CUSTOM
  table_name TEXT,
  record_id TEXT,
  summary TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_log_occurred_at ON public.audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table_action ON public.audit_log(table_name, action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert into audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- public can also insert (for failed login/anonymous events)
CREATE POLICY "Public can insert audit events"
  ON public.audit_log FOR INSERT
  TO anon
  WITH CHECK (action IN ('LOGIN_FAILED','LOGIN','LOGOUT'));

-- 2) deleted_items trash table
CREATE TABLE public.deleted_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  original_id TEXT NOT NULL,
  data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID,
  deleted_by_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  restored BOOLEAN NOT NULL DEFAULT false,
  restored_at TIMESTAMPTZ,
  restored_by UUID
);

CREATE INDEX idx_deleted_items_table ON public.deleted_items(table_name);
CREATE INDEX idx_deleted_items_deleted_at ON public.deleted_items(deleted_at DESC);
CREATE INDEX idx_deleted_items_expires ON public.deleted_items(expires_at);

ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view deleted items"
  ON public.deleted_items FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update deleted items"
  ON public.deleted_items FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete deleted items"
  ON public.deleted_items FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Helper to fetch current user's email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 4) Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := public.current_user_email();
  v_record_id TEXT;
  v_summary TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE(OLD.id::text, '');
    v_summary := 'Deleted row from ' || TG_TABLE_NAME;
    -- snapshot to trash
    INSERT INTO public.deleted_items(table_name, original_id, data, deleted_by, deleted_by_email)
    VALUES (TG_TABLE_NAME, v_record_id, to_jsonb(OLD), v_user_id, v_email);
    -- audit
    INSERT INTO public.audit_log(user_id, user_email, action, table_name, record_id, summary, old_data)
    VALUES (v_user_id, v_email, 'DELETE', TG_TABLE_NAME, v_record_id, v_summary, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := COALESCE(NEW.id::text, '');
    v_summary := 'Updated row in ' || TG_TABLE_NAME;
    INSERT INTO public.audit_log(user_id, user_email, action, table_name, record_id, summary, old_data, new_data)
    VALUES (v_user_id, v_email, 'UPDATE', TG_TABLE_NAME, v_record_id, v_summary, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := COALESCE(NEW.id::text, '');
    v_summary := 'Inserted new row into ' || TG_TABLE_NAME;
    INSERT INTO public.audit_log(user_id, user_email, action, table_name, record_id, summary, new_data)
    VALUES (v_user_id, v_email, 'INSERT', TG_TABLE_NAME, v_record_id, v_summary, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 5) Attach triggers to all sensitive tables
CREATE TRIGGER audit_job_postings AFTER INSERT OR UPDATE OR DELETE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_applicants AFTER INSERT OR UPDATE OR DELETE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_custom_questions AFTER INSERT OR UPDATE OR DELETE ON public.custom_questions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_custom_answers AFTER INSERT OR UPDATE OR DELETE ON public.custom_answers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_dropdown_options AFTER INSERT OR UPDATE OR DELETE ON public.dropdown_options FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_form_field_config AFTER INSERT OR UPDATE OR DELETE ON public.form_field_config FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_site_settings AFTER INSERT OR UPDATE OR DELETE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_user_permissions AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- 6) RPC: restore a deleted item
CREATE OR REPLACE FUNCTION public.restore_deleted_item(_deleted_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  cols TEXT;
  vals TEXT;
  sql TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can restore items';
  END IF;

  SELECT * INTO rec FROM public.deleted_items WHERE id = _deleted_id AND restored = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or already restored';
  END IF;

  -- Build dynamic insert from jsonb
  SELECT string_agg(quote_ident(key), ','), string_agg('(' || quote_literal(value::text) || ')::text', ',')
    INTO cols, vals
  FROM jsonb_each_text(rec.data);

  sql := format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, %L)',
                rec.table_name, rec.table_name, rec.data);
  EXECUTE sql;

  UPDATE public.deleted_items
    SET restored = true, restored_at = now(), restored_by = auth.uid()
    WHERE id = _deleted_id;

  INSERT INTO public.audit_log(user_id, user_email, action, table_name, record_id, summary, new_data)
  VALUES (auth.uid(), public.current_user_email(), 'RESTORE', rec.table_name, rec.original_id,
          'Restored deleted record', rec.data);

  RETURN rec.data;
END;
$$;

-- 7) Cleanup function for expired trash items (>30 days)
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.deleted_items WHERE expires_at < now() AND restored = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;