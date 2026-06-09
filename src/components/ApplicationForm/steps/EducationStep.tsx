import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useFieldConfig } from "@/hooks/useFieldConfig";

interface Props {
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const EducationStep = ({ data, onChange }: Props) => {
  const { t, lang } = useLanguage();
  const dd = useDropdownOptions(lang);
  const fc = useFieldConfig();

  const yesNoOptions = dd.getYesNoOptions();
  const show = fc.isVisible;
  const req = fc.isRequired;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-6">{t("step.edu")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {show("educationLevel") && <FormField label={lbl("educationLevel", t("field.educationLevel"))} name="educationLevel" type="select" required={false} value={data.educationLevel || ""} onChange={onChange} options={dd.getEducationLevels()} />}
        {show("major") && <FormField label={lbl("major", t("field.major"))} name="major" type="text" required={req("major")} value={data.major || ""} onChange={onChange} placeholder={t("ph.major")} />}
        {show("university") && <FormField label={lbl("university", t("field.university"))} name="university" type="text" required={req("university")} value={data.university || ""} onChange={onChange} placeholder={t("ph.university")} />}
        {show("graduationYear") && <FormField label={lbl("graduationYear", t("field.graduationYear"))} name="graduationYear" type="text" required={req("graduationYear")} value={data.graduationYear || ""} onChange={onChange} placeholder={t("ph.graduationYear")} />}
        {show("gpa") && <FormField label={lbl("gpa", t("field.gpa"))} name="gpa" type="text" required={req("gpa")} value={data.gpa || ""} onChange={onChange} placeholder={t("ph.gpa")} />}
        {show("currentlyStudying") && <FormField label={lbl("currentlyStudying", t("field.currentlyStudying"))} name="currentlyStudying" type="select" required={req("currentlyStudying")} value={data.currentlyStudying || ""} onChange={onChange} options={yesNoOptions} />}
        {show("currentlyStudying") && (data.currentlyStudying === t("opt.yes")) && (
          <FormField label={t("field.currentStudy")} name="currentStudy" type="text" required value={data.currentStudy || ""} onChange={onChange} placeholder={t("ph.currentStudy")} />
        )}
      </div>
    </div>
  );
};

export default EducationStep;
