import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCustomQuestions } from "@/hooks/useCustomQuestions";
import FormField from "../FormField";

interface Props {
  stepNumber: number;
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const CustomQuestionsStep = ({ stepNumber, data, onChange }: Props) => {
  const { lang } = useLanguage();
  // Shared with CustomQuestionsSettings (admin editor) so revisiting this
  // step within the staleTime window costs no extra fetch.
  const { questions: allQuestions } = useCustomQuestions();
  const questions = useMemo(
    () => allQuestions.filter(q => q.is_active && q.step_number === stepNumber),
    [allQuestions, stepNumber],
  );

  if (questions.length === 0) return null;

  return (
    <div className="space-y-5 mt-5 pt-5 border-t border-border">
      {questions.map((q) => {
        const label = lang === "ar" ? q.question_ar : (q.question_en || q.question_ar);
        const fieldName = `custom_${q.id}`;
        const options = lang === "ar"
          ? (q.options_ar || [])
          : (q.options_en?.length ? q.options_en : q.options_ar || []);

        return (
          <FormField
            key={q.id}
            label={label}
            name={fieldName}
            type={q.type as any}
            required={q.is_required}
            value={data[fieldName] || ""}
            onChange={onChange}
            options={q.type === "select" ? options : undefined}
          />
        );
      })}
    </div>
  );
};

export default CustomQuestionsStep;
