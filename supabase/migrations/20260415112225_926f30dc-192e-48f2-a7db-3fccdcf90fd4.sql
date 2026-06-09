-- Make otherExperience and linkedin optional
UPDATE public.form_field_config SET is_required = false WHERE field_name IN ('otherExperience', 'linkedin');

-- Resume is now handled in step 1, not step 6 attachments validation
UPDATE public.form_field_config SET step_number = 0, is_required = false WHERE field_name = 'resume';