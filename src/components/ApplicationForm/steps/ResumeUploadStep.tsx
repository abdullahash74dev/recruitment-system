import { Sparkles, Clock3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ResumeUploadStep = () => {
  const { lang } = useLanguage();

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-xl font-bold text-primary mb-2">
        {lang === "ar" ? "التعبئة الذكية" : "Smart Apply"}
      </h3>

      <div className="bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/20 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-accent-foreground" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-foreground text-base">
                {lang === "ar" ? "التعبئة الذكية بالسيرة الذاتية" : "AI resume auto-fill"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
                <Clock3 className="w-3.5 h-3.5" />
                {lang === "ar" ? "ميزة قادمة قريباً" : "Coming soon"}
              </span>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {lang === "ar"
                ? "نعمل حالياً على ربط السيرة الذاتية بالتعبئة الذكية لبعض البيانات مثل الاسم والخبرات والتعليم. سيتم تفعيل هذه الميزة لاحقاً بعد اكتمال الربط بشكل مستقر."
                : "We are currently preparing resume-based smart auto-fill for details like name, experience, and education. This feature will be enabled later once the integration is fully stable."}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground leading-relaxed">
          {lang === "ar"
            ? "حالياً لا يتم رفع أو قراءة السيرة الذاتية في هذه الخطوة. يمكنك المتابعة بشكل طبيعي، وسيكون إرفاق السيرة الذاتية إلزامياً في الخطوة الأخيرة قبل إرسال الطلب."
            : "No file is uploaded or parsed in this step for now. You can continue normally, and attaching your resume will be required in the final step before submission."}
        </div>
      </div>
    </div>
  );
};

export default ResumeUploadStep;
