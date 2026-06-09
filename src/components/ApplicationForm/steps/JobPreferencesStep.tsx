import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useFieldConfig } from "@/hooks/useFieldConfig";

interface Props {
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const JobPreferencesStep = ({ data, onChange }: Props) => {
  const { t, lang } = useLanguage();
  const dd = useDropdownOptions(lang);
  const fc = useFieldConfig();

  const cityOptions = dd.getPreferredCities();
  const jobTypeOptions = dd.getJobTypes();
  const hearOptions = dd.getHearAboutOptions();

  const basePositions = dd.getJobPositions();
  const currentValue = data.desiredPosition || "";
  const positionOptions = currentValue && !basePositions.includes(currentValue)
    ? [currentValue, ...basePositions]
    : basePositions;

  const show = fc.isVisible;
  const req = fc.isRequired;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-6">{t("step.job")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {show("desiredPosition") && (
          <div className="md:col-span-2">
            <FormField label={lbl("desiredPosition", t("field.desiredPosition"))} name="desiredPosition" type="select" required={req("desiredPosition")} value={currentValue} onChange={onChange} options={positionOptions} />
          </div>
        )}
        {show("jobType") && <FormField label={lbl("jobType", t("field.jobType"))} name="jobType" type="select" required={true} value={data.jobType || ""} onChange={onChange} options={jobTypeOptions} />}
        {show("preferredCity") && <FormField label={lbl("preferredCity", t("field.preferredCity"))} name="preferredCity" type="select" required={req("preferredCity")} value={data.preferredCity || ""} onChange={onChange} options={cityOptions} />}
        {show("hearAbout") && (
          <div className="md:col-span-2">
            <FormField label={lbl("hearAbout", t("field.hearAbout"))} name="hearAbout" type="select" required={req("hearAbout")} value={data.hearAbout || ""} onChange={onChange} options={hearOptions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default JobPreferencesStep;
