import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Send, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useFieldConfig, type FieldConfig } from "@/hooks/useFieldConfig";
import { useSiteContent } from "@/hooks/useSiteContent";
import StepIndicator from "./StepIndicator";
import ResumeUploadStep from "./steps/ResumeUploadStep";
import BasicInfoStep from "./steps/BasicInfoStep";
import JobPreferencesStep from "./steps/JobPreferencesStep";
import EducationStep from "./steps/EducationStep";
import ExperienceStep from "./steps/ExperienceStep";
import FinancialsStep from "./steps/FinancialsStep";
import AttachmentsStep from "./steps/AttachmentsStep";
import CustomQuestionsStep from "./steps/CustomQuestionsStep";

const STORAGE_KEY = "akg-application-draft";
const TOTAL_STEPS = 7;

const cloneFileForUpload = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();

  return new File([arrayBuffer], file.name?.trim() || `upload-${Date.now()}`, {
    type: file.type || "application/octet-stream",
    lastModified: Date.now(),
  });
};

const createSubmissionToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashSubmissionToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const getEdgeFunctionErrorMessage = async (error: unknown) => {
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (context instanceof Response) {
      try {
        const raw = await context.text();

        if (raw.trim()) {
          try {
            const parsed = JSON.parse(raw) as { error?: unknown };

            if (typeof parsed.error === "string" && parsed.error.trim()) {
              return parsed.error;
            }
          } catch {
            return raw;
          }

          return raw;
        }
      } catch {
        // ignore parsing issues and fall back to generic messages below
      }

      return context.statusText || undefined;
    }
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    return message?.trim() ? message : undefined;
  }

  return undefined;
};

interface Props {
  preSelectedPosition?: string;
}

const ApplicationForm = ({ preSelectedPosition }: Props) => {
  const { t, lang, dir } = useLanguage();
  const fc = useFieldConfig();
  const { content: siteContent } = useSiteContent();

  const stepLabels = [
    lang === "ar" ? "التعبئة الذكية" : "Smart Apply",
    t("step.basic"), t("step.job"), t("step.edu"),
    t("step.exp"), t("step.fin"), t("step.attach"),
  ];

  const getFieldLabel = (fieldName: string): string => {
    const label = fc.getLabel(fieldName, lang, "");
    if (label) return label;
    const key = `field.${fieldName}`;
    const translated = t(key);
    return translated !== key ? translated : fieldName;
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [pendingFileReads, setPendingFileReads] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isPreparingFiles = pendingFileReads > 0;

  useEffect(() => {
    if (!preSelectedPosition) return;
    setFormData((prev) =>
      prev.desiredPosition === preSelectedPosition
        ? prev
        : { ...prev, desiredPosition: preSelectedPosition }
    );
  }, [preSelectedPosition]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback(async (name: string, file: File | null) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [name]: null }));
      return;
    }

    setPendingFileReads((prev) => prev + 1);

    try {
      const preparedFile = await cloneFileForUpload(file);
      setFiles((prev) => ({ ...prev, [name]: preparedFile }));
    } catch (error) {
      console.error("File preparation error:", error);
      setFiles((prev) => ({ ...prev, [name]: null }));
      toast.error(
        lang === "ar"
          ? `تعذر قراءة ملف ${getFieldLabel(name)} من جهازك. اختر الملف مرة أخرى من ذاكرة الجهاز ثم أعد المحاولة.`
          : `Could not read the ${getFieldLabel(name)} from your device. Please choose it again from local storage and try again.`
      );
    } finally {
      setPendingFileReads((prev) => Math.max(0, prev - 1));
    }
  }, [getFieldLabel, lang]);

  const getSubmitErrorMessage = (error: unknown) => {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message?: string }).message
        : undefined;

    const normalized = message?.toLowerCase() || "";

    if (normalized.includes("too many submissions")) {
      return lang === "ar"
        ? "تم تجاوز عدد محاولات التقديم من هذا الاتصال. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى."
        : "Too many submissions from this network. Please wait a while before submitting again.";
    }

    if (normalized.includes("too many requests")) {
      return lang === "ar"
        ? "تم تجاوز عدد المحاولات المسموحة من هذا الاتصال. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى."
        : "Too many requests from this network. Please wait a while before trying again.";
    }

    return message?.trim()
      ? message
      : lang === "ar"
        ? "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى."
        : "Failed to submit the application. Please try again.";
  };

  const getMissingFieldsForStep = (stepNumber: number): string[] => {
    const required = fc.getRequiredFields(stepNumber);
    return required.filter((field) => !formData[field] && !files[field]);
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) return true;
    const missing = getMissingFieldsForStep(currentStep - 1);
    if (missing.length > 0) {
      const fieldNames = missing.map(getFieldLabel).join("، ");
      toast.error(
        lang === "ar"
          ? `حقول مطلوبة ناقصة: ${fieldNames}`
          : `Missing required fields: ${fieldNames}`
      );
      return false;
    }
    return true;
  };

  const validateAllSteps = (): boolean => {
    for (let step = 1; step <= 5; step++) {
      const missing = getMissingFieldsForStep(step);
      if (missing.length > 0) {
        const uiStep = step + 1; // step 1 → UI step 2
        const fieldNames = missing.map(getFieldLabel).join("، ");
        const stepName = stepLabels[step] || `${step}`;
        toast.error(
          lang === "ar"
            ? `حقول ناقصة في "${stepName}": ${fieldNames}`
            : `Missing fields in "${stepName}": ${fieldNames}`,
          {
            duration: 8000,
            action: {
              label: lang === "ar" ? `← الانتقال للخطوة` : `Go to step →`,
              onClick: () => {
                setCurrentStep(uiStep);
                window.scrollTo({ top: 0, behavior: "smooth" });
              },
            },
          }
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getUploadErrorMessage = (
    message: string | undefined,
    fileLabel: { ar: string; en: string }
  ) => {
    const normalized = message?.toLowerCase() || "";

    if (normalized.includes("too many upload attempts")) {
      return lang === "ar"
        ? "تم تجاوز عدد محاولات رفع الملفات من هذا الاتصال. انتظر بضع دقائق ثم أعد المحاولة."
        : "Too many upload attempts from this network. Please wait a few minutes and try again.";
    }

    if (normalized.includes("failed to fetch")) {
      return lang === "ar"
        ? "تعذر الاتصال بخدمة رفع الملفات. حدّث الصفحة ثم أعد المحاولة."
        : "Could not reach the upload service. Refresh the page and try again.";
    }

    if (
      normalized.includes("failed to send a request") ||
      normalized.includes("network request failed") ||
      normalized.includes("failed to execute 'fetch'")
    ) {
      return lang === "ar"
        ? "تعذر إرسال الملف من جهازك إلى خدمة الرفع. اختر الملف مرة أخرى ثم أعد المحاولة."
        : "Could not send the file from your device to the upload service. Please choose the file again and try once more.";
    }

    if (normalized.includes("file too large")) {
      return lang === "ar"
        ? `حجم ${fileLabel.ar} كبير جداً. الحد الأقصى 10MB.`
        : `The ${fileLabel.en} is too large. The maximum allowed size is 10MB.`;
    }

    if (normalized.includes("empty or unreadable")) {
      return lang === "ar"
        ? `ملف ${fileLabel.ar} فارغ أو غير قابل للقراءة. اختر الملف الأصلي من جهازك ثم حاول مرة أخرى.`
        : `The ${fileLabel.en} is empty or unreadable. Please choose the original file from your device and try again.`;
    }

    if (
      normalized.includes("file type") ||
      normalized.includes("does not match its extension")
    ) {
      return lang === "ar"
        ? `صيغة ${fileLabel.ar} غير مدعومة أو أن الملف غير صالح. استخدم ملف PDF أو DOC أو DOCX صالحاً.`
        : `The ${fileLabel.en} type is not supported or the file is invalid. Please use a valid PDF, DOC, or DOCX file.`;
    }

    return lang === "ar"
      ? `تعذر رفع ${fileLabel.ar}. يرجى المحاولة مرة أخرى.`
      : `Failed to upload the ${fileLabel.en}. Please try again.`;
  };

  const isTransientNetworkError = (message: string | undefined) => {
    const normalized = message?.toLowerCase() || "";
    return (
      normalized.includes("failed to fetch") ||
      normalized.includes("failed to send a request") ||
      normalized.includes("network request failed") ||
      normalized.includes("failed to execute 'fetch'")
    );
  };

  const UPLOAD_RETRY_ATTEMPTS = 3;
  const UPLOAD_RETRY_DELAY_MS = 1200;

  const uploadFile = async (file: File, folder: string, applicantId: string, submissionToken: string, kind: string) => {
    let lastError = new Error("Upload failed");

    for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
      const requestBody = new FormData();
      requestBody.append("file", file, file.name);
      requestBody.append("folder", folder);
      requestBody.append("applicantId", applicantId);
      requestBody.append("submissionToken", submissionToken);
      requestBody.append("kind", kind);

      try {
        const { data, error } = await supabase.functions.invoke("upload-file", {
          body: requestBody,
        });

        if (error) {
          const errorMessage = await getEdgeFunctionErrorMessage(error);
          throw new Error(errorMessage || error.message || "Upload failed");
        }

        const result = data as { path?: unknown } | null;

        if (typeof result?.path !== "string") {
          throw new Error("Upload failed");
        }

        return result.path;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Upload failed");
        console.error(`Upload attempt ${attempt} failed:`, lastError);

        // Connection drops (common on mobile networks) are transient — retry
        // with a short delay before giving up. Other errors (validation,
        // token, file-type) won't be fixed by retrying.
        if (attempt < UPLOAD_RETRY_ATTEMPTS && isTransientNetworkError(lastError.message)) {
          await new Promise((resolve) => setTimeout(resolve, attempt * UPLOAD_RETRY_DELAY_MS));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  };

  const uploadSelectedFile = async (
    file: File | null | undefined,
    folder: string,
    fileLabel: { ar: string; en: string },
    applicantId: string,
    submissionToken: string,
    kind: string
  ) => {
    if (!file) return null;

    try {
      return await uploadFile(file, folder, applicantId, submissionToken, kind);
    } catch (error) {
      throw new Error(
        getUploadErrorMessage(
          error instanceof Error ? error.message : undefined,
          fileLabel
        )
      );
    }
  };

  const handleSubmit = async () => {
    if (!validateAllSteps()) return;

    if (isPreparingFiles) {
      toast.error(
        lang === "ar"
          ? "انتظر حتى يكتمل تجهيز الملف المرفوع، ثم أعد الإرسال."
          : "Please wait for the selected file to finish preparing, then submit again."
      );
      return;
    }

    if (!files.resume) {
      toast.error(
        lang === "ar"
          ? "السيرة الذاتية مطلوبة — يرجى إرفاقها أعلاه قبل الإرسال"
          : "Resume is required — please attach it above before submitting",
        { duration: 6000 }
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionToken = createSubmissionToken();
      const submissionTokenHash = await hashSubmissionToken(submissionToken);

      // Duplicate detection BEFORE creating new applicant
      if (formData.email && formData.phone && formData.fullName) {
        const { data: dup } = await supabase.rpc("find_duplicate_applicant", {
          _email: formData.email,
          _phone: formData.phone,
          _full_name: formData.fullName,
        });
        const existing = Array.isArray(dup) && dup.length > 0 ? dup[0] : null;
        if (existing) {
          const confirmUpdate = window.confirm(
            (lang === "ar"
              ? `تم اكتشاف تقديم سابق بنفس بياناتك (الاسم/الإيميل/الجوال).\n\nالطلب الأصلي: ${existing.desired_position || "—"}\nبتاريخ: ${new Date(existing.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}\n\nهل تريد تحديث طلبك السابق بدلاً من إنشاء طلب جديد؟`
              : `A previous application with the same name/email/mobile was found.\n\nOriginal: ${existing.desired_position || "—"}\nOn: ${new Date(existing.created_at).toLocaleDateString("en-US")}\n\nDo you want to UPDATE your previous application instead of creating a new one?`)
          );
          if (confirmUpdate) {
            const payload: Record<string, unknown> = {
              desired_position: formData.desiredPosition,
              job_type: formData.jobType,
              preferred_city: formData.preferredCity,
              current_city: formData.currentCity,
              has_transport: formData.hasTransport,
              gender: formData.gender,
              nationality: formData.nationality,
              birth_date: formData.birthDate || null,
              marital_status: formData.maritalStatus,
              dependents: parseInt(formData.dependents) || 0,
              education_level: formData.educationLevel,
              major: formData.major,
              university: formData.university,
              graduation_year: formData.graduationYear,
              gpa: formData.gpa,
              currently_studying: formData.currentlyStudying,
              current_study: formData.currentStudy || null,
              years_experience: formData.yearsExperience,
              currently_employed: formData.currentlyEmployed,
              current_title: formData.currentTitle,
              current_tasks: formData.currentTasks,
              self_summary: formData.selfSummary,
              arabic_level: formData.arabicLevel,
              english_level: formData.englishLevel,
              other_language: formData.otherLanguage,
              linkedin: formData.linkedin,
              current_salary: formData.currentSalary,
              expected_salary: formData.expectedSalary,
              available_date: formData.availableDate,
              hear_about: formData.hearAbout,
              submission_token_hash: submissionTokenHash,
            };

            const { error: rpcErr } = await supabase.rpc("update_existing_application", {
              _applicant_id: existing.id,
              _email: formData.email,
              _phone: formData.phone,
              _full_name: formData.fullName,
              _payload: payload as any,
            });
            if (rpcErr) throw rpcErr;

            // Upload files (only for the ones the user re-uploaded). The upload service verifies this short-lived token.
            if (files.resume) await uploadSelectedFile(files.resume, "resumes", { ar: "السيرة الذاتية", en: "resume" }, existing.id, submissionToken, "resume");
            if (files.degreeCopy) await uploadSelectedFile(files.degreeCopy, "degrees", { ar: "صورة المؤهل", en: "degree copy" }, existing.id, submissionToken, "degree");
            if (files.trainingCerts) await uploadSelectedFile(files.trainingCerts, "training", { ar: "شهادات التدريب", en: "training certificates" }, existing.id, submissionToken, "training");
            if (files.otherDocs) await uploadSelectedFile(files.otherDocs, "other", { ar: "المستندات الأخرى", en: "other documents" }, existing.id, submissionToken, "other");

            setIsSubmitted(true);
            localStorage.removeItem(STORAGE_KEY);
            toast.success(t("dup.updated"));
            setIsSubmitting(false);
            return;
          }
          // If user cancels, fall through to create a new application
        }
      }

      const applicantId = crypto.randomUUID();

      const isEmployed = formData.currentlyEmployed === "نعم" || formData.currentlyEmployed === "Yes";

      const { error } = await (supabase as any).from("applicants").insert({
        id: applicantId,
        full_name: formData.fullName,
        gender: formData.gender,
        nationality: formData.nationality,
        birth_date: formData.birthDate || null,
        marital_status: formData.maritalStatus,
        dependents: parseInt(formData.dependents) || 0,
        phone: formData.phone,
        email: formData.email,
        current_city: formData.currentCity,
        has_transport: formData.hasTransport,
        desired_position: formData.desiredPosition,
        job_type: formData.jobType,
        preferred_city: formData.preferredCity,
        hear_about: formData.hearAbout,
        education_level: formData.educationLevel,
        major: formData.major,
        university: formData.university,
        graduation_year: formData.graduationYear,
        gpa: formData.gpa,
        currently_studying: formData.currentlyStudying,
        current_study: formData.currentStudy || null,
        years_experience: formData.yearsExperience,
        currently_employed: formData.currentlyEmployed,
        current_title: isEmployed ? formData.currentTitle : null,
        current_tasks: isEmployed ? (formData.currentTasks || null) : null,
        self_summary: formData.selfSummary,
        other_experience: null,
        arabic_level: formData.arabicLevel,
        english_level: formData.englishLevel,
        other_language: formData.otherLanguage,
        linkedin: formData.linkedin,
        facility_management_exp: formData.facilityManagementExp || null,
        current_salary: formData.currentSalary,
        expected_salary: formData.expectedSalary,
        available_date: formData.availableDate,
        resume_url: null,
        degree_url: null,
        experience_cert_url: null,
        training_certs_url: null,
        other_docs_url: null,
        submission_token_hash: submissionTokenHash,
      });

      if (error) throw error;

      await uploadSelectedFile(files.resume, "resumes", {
        ar: "السيرة الذاتية",
        en: "resume",
      }, applicantId, submissionToken, "resume");
      await uploadSelectedFile(files.degreeCopy, "degrees", {
        ar: "صورة المؤهل",
        en: "degree copy",
      }, applicantId, submissionToken, "degree");
      await uploadSelectedFile(files.trainingCerts, "training", {
        ar: "شهادات التدريب",
        en: "training certificates",
      }, applicantId, submissionToken, "training");
      await uploadSelectedFile(files.otherDocs, "other", {
        ar: "المستندات الأخرى",
        en: "other documents",
      }, applicantId, submissionToken, "other");

      const customAnswers = Object.entries(formData)
        .filter(([key, val]) => key.startsWith("custom_") && val)
        .map(([key, val]) => ({
          applicant_id: applicantId,
          question_id: key.replace("custom_", ""),
          answer: val,
          submission_token_hash: submissionTokenHash,
        }));

      if (customAnswers.length > 0) {
        const { error: answersError } = await (supabase as any).from("custom_answers").insert(customAnswers);
        if (answersError) throw answersError;
      }

      // Send confirmation email (non-blocking)
      supabase.functions.invoke("send-confirmation-email", {
        body: {
          email: formData.email,
          fullName: formData.fullName,
          position: formData.desiredPosition,
        },
      }).catch((emailErr) => {
        console.warn("Confirmation email failed (non-blocking):", emailErr);
      });

      setIsSubmitted(true);
      localStorage.removeItem(STORAGE_KEY);
      toast.success(t("validation.success"));
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(getSubmitErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const NextArrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const PrevArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  if (isSubmitted) {
    const successTitle = lang === "ar" ? siteContent.success_title_ar : siteContent.success_title_en;
    const successDesc = lang === "ar" ? siteContent.success_desc_ar : siteContent.success_desc_en;

    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-full gradient-accent flex items-center justify-center">
            <Send className="w-10 h-10 text-accent-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-primary">{successTitle}</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">{successDesc}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({});
                setFiles({});
                setCurrentStep(1);
              }}
              className="gradient-accent text-accent-foreground hover:opacity-90 px-8"
            >
              {t("btn.newApplication")}
            </Button>
            <Link to="/track">
              <Button variant="outline" className="gap-2">
                <ListChecks className="w-4 h-4" />
                {t("nav.track")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto" dir={dir}>
      <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} stepLabels={stepLabels} />

      <div className="bg-card rounded-xl shadow-elevated p-6 md:p-8 border border-border">
        {currentStep === 1 && <ResumeUploadStep />}
        {currentStep === 2 && <><BasicInfoStep data={formData} onChange={handleChange} /><CustomQuestionsStep stepNumber={1} data={formData} onChange={handleChange} /></>}
        {currentStep === 3 && <><JobPreferencesStep data={formData} onChange={handleChange} /><CustomQuestionsStep stepNumber={2} data={formData} onChange={handleChange} /></>}
        {currentStep === 4 && <><EducationStep data={formData} onChange={handleChange} /><CustomQuestionsStep stepNumber={3} data={formData} onChange={handleChange} /></>}
        {currentStep === 5 && <><ExperienceStep data={formData} onChange={handleChange} /><CustomQuestionsStep stepNumber={4} data={formData} onChange={handleChange} /></>}
        {currentStep === 6 && <><FinancialsStep data={formData} onChange={handleChange} /><CustomQuestionsStep stepNumber={5} data={formData} onChange={handleChange} /></>}
        {currentStep === 7 && <><AttachmentsStep onChange={handleChange} onFileChange={handleFileChange} hasResume={!!files.resume} /><CustomQuestionsStep stepNumber={6} data={formData} onChange={handleChange} /></>}

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1} className="gap-2">
            <PrevArrow className="w-4 h-4" />
            {t("btn.prev")}
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="gradient-primary text-primary-foreground hover:opacity-90 gap-2">
              {t("btn.next")}
              <NextArrow className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isPreparingFiles}
              className="gradient-accent text-accent-foreground hover:opacity-90 gap-2 px-8"
            >
              {isSubmitting || isPreparingFiles ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isPreparingFiles
                    ? (lang === "ar" ? "جارٍ تجهيز الملف..." : "Preparing file...")
                    : t("btn.submitting")}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t("btn.submit")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
