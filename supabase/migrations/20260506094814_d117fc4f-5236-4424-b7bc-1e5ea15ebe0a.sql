CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view app secrets" ON public.app_secrets;
DROP POLICY IF EXISTS "Admins can insert app secrets" ON public.app_secrets;
DROP POLICY IF EXISTS "Admins can update app secrets" ON public.app_secrets;
DROP POLICY IF EXISTS "Admins can delete app secrets" ON public.app_secrets;

CREATE POLICY "Admins can view app secrets"
ON public.app_secrets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert app secrets"
ON public.app_secrets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app secrets"
ON public.app_secrets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete app secrets"
ON public.app_secrets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));