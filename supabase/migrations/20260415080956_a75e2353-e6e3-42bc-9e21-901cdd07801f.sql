
-- Add explicit admin-only DELETE policy on applicants
CREATE POLICY "Admins can delete applicants"
ON public.applicants
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add explicit admin-only UPDATE policy on user_roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
