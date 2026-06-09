-- Explicitly block all UPDATEs on applicant_emails (audit log integrity)
CREATE POLICY "Block all updates on applicant_emails"
ON public.applicant_emails
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.applicant_emails IS 'Append-only email log. UPDATEs are intentionally blocked via a RESTRICTIVE policy to preserve audit integrity.';