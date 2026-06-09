
-- 1. Restrict rejection_reasons to admin/HR only (remove public read)
DROP POLICY IF EXISTS "Anyone can view active rejection reasons" ON public.rejection_reasons;

-- 2. Tighten ai_usage_log insert: must be own user_id or admin/HR
DROP POLICY IF EXISTS "Authenticated can insert ai usage" ON public.ai_usage_log;
CREATE POLICY "Authenticated can insert own ai usage"
ON public.ai_usage_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR is_admin_or_hr(auth.uid()));
