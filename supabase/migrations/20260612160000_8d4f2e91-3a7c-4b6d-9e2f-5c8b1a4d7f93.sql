-- The Experience step merged the legacy "currentTasks" field into the unified
-- "selfSummary" field, but form_field_config still marks currentTasks as
-- visible+required with no corresponding input in the form. This makes the
-- field permanently "missing" and blocks application submission.
UPDATE public.form_field_config
SET is_required = false, is_visible = false
WHERE field_name = 'currentTasks';
