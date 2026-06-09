import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useFieldConfig } from "@/hooks/useFieldConfig";

interface Props {
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const FinancialsStep = ({ data, onChange }: Props) => {
  const { t, lang } = useLanguage();
  const dd = useDropdownOptions(lang);
  const fc = useFieldConfig();

  const dateOptions = dd.getAvailableDates();

  const show = fc.isVisible;
  const req = fc.isRequired;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-6">{t("step.fin")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {show("currentSalary") && <FormField label={lbl("currentSalary", t("field.currentSalary"))} name="currentSalary" type="select" required={req("currentSalary")} value={data.currentSalary || ""} onChange={onChange} options={dd.getSalaryRanges()} />}
        {show("expectedSalary") && <FormField label={lbl("expectedSalary", t("field.expectedSalary"))} name="expectedSalary" type="select" required={req("expectedSalary")} value={data.expectedSalary || ""} onChange={onChange} options={dd.getSalaryRanges()} />}
        {show("availableDate") && <FormField label={lbl("availableDate", t("field.availableDate"))} name="availableDate" type="select" required={req("availableDate")} value={data.availableDate || ""} onChange={onChange} options={dateOptions} />}
      </div>
    </div>
  );
};

export default FinancialsStep;
