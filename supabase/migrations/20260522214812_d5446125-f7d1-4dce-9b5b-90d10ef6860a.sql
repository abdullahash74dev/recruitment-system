CREATE OR REPLACE FUNCTION public.validate_applicant_birth_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL THEN
    IF NEW.birth_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'تاريخ ميلاد غير منطقي: التاريخ في المستقبل';
    END IF;

    IF NEW.birth_date < (CURRENT_DATE - INTERVAL '100 years')::date THEN
      RAISE EXCEPTION 'تاريخ ميلاد غير منطقي: العمر أكبر من 100 سنة';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_applicant_birth_date_before_save ON public.applicants;

CREATE TRIGGER validate_applicant_birth_date_before_save
BEFORE INSERT OR UPDATE OF birth_date ON public.applicants
FOR EACH ROW
EXECUTE FUNCTION public.validate_applicant_birth_date();