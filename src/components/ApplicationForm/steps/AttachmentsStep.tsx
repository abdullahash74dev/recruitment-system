import FormField from "../FormField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFieldConfig } from "@/hooks/useFieldConfig";

interface Props {
  onChange: (name: string, value: string) => void;
  onFileChange: (name: string, file: File | null) => void;
  hasResume?: boolean;
}

const AttachmentsStep = ({ onChange, onFileChange, hasResume }: Props) => {
  const { t, lang } = useLanguage();
  const fc = useFieldConfig();

  const show = fc.isVisible;
  const lbl = (name: string, fallback: string) => fc.getLabel(name, lang, fallback);

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-2">{t("step.attach")}</h3>
      <p className="text-muted-foreground text-sm">
        {lang === "ar"
          ? "أرفق السيرة الذاتية هنا بشكل إلزامي قبل إرسال الطلب، ويمكنك أيضاً رفع بقية المستندات الداعمة (اختيارية)."
          : "Attach your resume here before submitting. Other supporting documents are optional."}
      </p>

      <div className="space-y-2">
        {hasResume ? (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">✓</div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {lang === "ar" ? "تم إرفاق السيرة الذاتية بنجاح" : "Resume attached successfully"}
              </p>
              <p className="text-muted-foreground text-xs">
                {lang === "ar" ? "يمكنك الآن إرسال الطلب أو استبدال الملف قبل الإرسال" : "You can now submit the application or replace the file before submitting"}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-sm font-bold">!</div>
            <p className="font-medium text-destructive text-sm">
              {lang === "ar" ? "السيرة الذاتية مطلوبة في هذه الخطوة قبل إرسال الطلب" : "Resume is required in this step before submitting"}
            </p>
          </div>
        )}

        <FormField
          label={lbl("resume", lang === "ar" ? "السيرة الذاتية" : "Resume/CV")}
          name="resume"
          type="file"
          required
          value=""
          onChange={onChange}
          onFileChange={onFileChange}
          accept=".pdf,.doc,.docx"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        {show("degreeCopy") && <FormField label={lbl("degreeCopy", t("field.degreeCopy"))} name="degreeCopy" type="file" required={false} value="" onChange={onChange} onFileChange={onFileChange} accept=".pdf,.jpg,.jpeg,.png" />}
        {show("trainingCerts") && <FormField label={lbl("trainingCerts", t("field.trainingCerts"))} name="trainingCerts" type="file" required={false} value="" onChange={onChange} onFileChange={onFileChange} accept=".pdf,.jpg,.jpeg,.png" />}
        {show("otherDocs") && <FormField label={lbl("otherDocs", t("field.otherDocs"))} name="otherDocs" type="file" required={false} value="" onChange={onChange} onFileChange={onFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />}
      </div>
    </div>
  );
};

export default AttachmentsStep;
