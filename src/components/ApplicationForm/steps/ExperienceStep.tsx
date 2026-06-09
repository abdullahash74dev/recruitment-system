import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useEffect } from "react";

interface Props {
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const ExperienceStep = ({ data, onChange }: Props) => {
  const { t, lang } = useLanguage();
  const dd = useDropdownOptions(lang);
  const fc = useFieldConfig();

  const yesNoOptions = dd.getYesNoOptions();
  const langLevelOptions = dd.getLanguageLevels();

  const show = fc.isVisible;
  const req = fc.isRequired;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  // Auto-clear currentTitle/currentTasks when not employed
  const isEmployed = data.currentlyEmployed === "نعم" || data.currentlyEmployed === "Yes" || data.currentlyEmployed === "yes";
  useEffect(() => {
    if (!isEmployed) {
      if (data.currentTitle) onChange("currentTitle", "");
      if (data.currentTasks) onChange("currentTasks", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.currentlyEmployed]);

  const placeholderSummary = lang === "ar"
    ? t("ph.selfSummaryMerged")
    : t("ph.selfSummaryMerged");

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-6">{t("step.exp")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {show("yearsExperience") && <FormField label={lbl("yearsExperience", t("field.yearsExperience"))} name="yearsExperience" type="select" required={req("yearsExperience")} value={data.yearsExperience || ""} onChange={onChange} options={dd.getYearsOfExperience()} />}
        {show("currentlyEmployed") && <FormField label={lbl("currentlyEmployed", t("field.currentlyEmployed"))} name="currentlyEmployed" type="select" required={req("currentlyEmployed")} value={data.currentlyEmployed || ""} onChange={onChange} options={yesNoOptions} />}
        {isEmployed && show("currentTitle") && <FormField label={lbl("currentTitle", t("field.currentTitle"))} name="currentTitle" type="text" required={req("currentTitle")} value={data.currentTitle || ""} onChange={onChange} placeholder={t("ph.currentTitle")} />}

        {/* Merged Self Summary (replaces currentTasks + selfSummary + otherExperience) */}
        {show("selfSummary") && (
          <div className="md:col-span-2">
            <FormField
              label={lbl("selfSummary", t("field.selfSummary"))}
              name="selfSummary"
              type="textarea"
              required={req("selfSummary")}
              value={data.selfSummary || ""}
              onChange={onChange}
              placeholder={placeholderSummary}
            />
          </div>
        )}

        {show("arabicLevel") && <FormField label={lbl("arabicLevel", t("field.arabicLevel"))} name="arabicLevel" type="select" required={req("arabicLevel")} value={data.arabicLevel || ""} onChange={onChange} options={langLevelOptions} />}
        {show("englishLevel") && <FormField label={lbl("englishLevel", t("field.englishLevel"))} name="englishLevel" type="select" required={req("englishLevel")} value={data.englishLevel || ""} onChange={onChange} options={langLevelOptions} />}
        {show("otherLanguage") && <FormField label={lbl("otherLanguage", t("field.otherLanguage"))} name="otherLanguage" type="text" required={req("otherLanguage")} value={data.otherLanguage || ""} onChange={onChange} placeholder={t("ph.otherLanguage")} />}
        {show("linkedin") && (
          <div>
            <FormField label={lbl("linkedin", t("field.linkedin"))} name="linkedin" type="text" required={req("linkedin")} value={data.linkedin || ""} onChange={(n, v) => onChange(n, v.trim())} placeholder={t("ph.linkedin")} />
            {data.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(data.linkedin) && (
              <p className="text-xs text-destructive mt-1">{lang === "ar" ? "يجب أن يكون رابط LinkedIn صحيحًا (مثال: https://linkedin.com/in/...)" : "Must be a valid LinkedIn URL (e.g. https://linkedin.com/in/...)"}</p>
            )}
          </div>
        )}
        {show("facilityManagementExp") && (
          <div className="md:col-span-2">
            <FormField label={lbl("facilityManagementExp", t("field.facilityManagementExp"))} name="facilityManagementExp" type="select" required={req("facilityManagementExp")} value={data.facilityManagementExp || ""} onChange={onChange} options={dd.getFacilityMgmtOptions()} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperienceStep;
