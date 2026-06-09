import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const BasicInfoStep = ({ data, onChange }: Props) => {
  const { t, lang, dir } = useLanguage();
  const dd = useDropdownOptions(lang);
  const fc = useFieldConfig();

  const genderOptions = dd.getGenderOptions();
  const maritalOptions = dd.getMaritalStatusOptions();
  const transportOptions = dd.getYesNoOptions();
  const nationalities = dd.getNationalities();
  const cities = dd.getCurrentCities();

  const otherLabel = lang === "ar" ? "أخرى" : "Other";
  const isOtherNationality = data.nationality === otherLabel;

  const show = fc.isVisible;
  const req = fc.isRequired;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-6">{t("step.basic")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {show("fullName") && <FormField label={lbl("fullName", t("field.fullName"))} name="fullName" required={req("fullName")} value={data.fullName || ""} onChange={onChange} placeholder={t("ph.fullName")} />}
        {show("gender") && <FormField label={lbl("gender", t("field.gender"))} name="gender" type="select" required={req("gender")} value={data.gender || ""} onChange={onChange} options={genderOptions} />}
        {show("nationality") && <FormField label={lbl("nationality", t("field.nationality"))} name="nationality" type="select" required={req("nationality")} value={data.nationality || ""} onChange={onChange} options={nationalities} />}
        {show("nationality") && isOtherNationality && (
          <div className="space-y-2">
            <Label htmlFor="nationalityOther" className="text-sm font-medium text-foreground">
              {lang === "ar" ? "حدد الجنسية" : "Specify Nationality"}
              <span className={`text-destructive ${dir === "rtl" ? "mr-1" : "ml-1"}`}>*</span>
            </Label>
            <Input
              id="nationalityOther"
              value={data.nationalityOther || ""}
              onChange={(e) => onChange("nationalityOther", e.target.value)}
              placeholder={lang === "ar" ? "اكتب جنسيتك" : "Enter your nationality"}
              className={`bg-background border-input focus:ring-ring ${dir === "rtl" ? "text-right" : "text-left"}`}
              dir={dir}
            />
          </div>
        )}
        {show("birthDate") && <FormField label={lbl("birthDate", t("field.birthDate"))} name="birthDate" type="date" required={req("birthDate")} value={data.birthDate || ""} onChange={onChange} />}
        {show("maritalStatus") && <FormField label={lbl("maritalStatus", t("field.maritalStatus"))} name="maritalStatus" type="select" required={req("maritalStatus")} value={data.maritalStatus || ""} onChange={onChange} options={maritalOptions} />}
        {show("dependents") && <FormField label={lbl("dependents", t("field.dependents"))} name="dependents" type="number" required={req("dependents")} value={data.dependents || ""} onChange={onChange} placeholder={t("ph.dependents")} />}
        {show("phone") && <FormField label={lbl("phone", t("field.phone"))} name="phone" type="tel" required={req("phone")} value={data.phone || ""} onChange={onChange} placeholder={t("ph.phone")} />}
        {show("email") && <FormField label={lbl("email", t("field.email"))} name="email" type="email" required={req("email")} value={data.email || ""} onChange={onChange} placeholder={t("ph.email")} />}
        {show("currentCity") && <FormField label={lbl("currentCity", t("field.currentCity"))} name="currentCity" type="select" required={req("currentCity")} value={data.currentCity || ""} onChange={onChange} options={cities} />}
        {show("hasTransport") && <FormField label={lbl("hasTransport", t("field.hasTransport"))} name="hasTransport" type="select" required={req("hasTransport")} value={data.hasTransport || ""} onChange={onChange} options={transportOptions} />}
      </div>
    </div>
  );
};

export default BasicInfoStep;
