import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import FormField from "../FormField";

interface CustomQuestion {
  id: string;
  question_ar: string;
  question_en: string | null;
  type: string;
  options_ar: string[];
  options_en: string[];
  is_required: boolean;
  step_number: number;
  sort_order: number;
}

interface Props {
  stepNumber: number;
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const CustomQuestionsStep = ({ stepNumber, data, onChange }: Props) => {
  const { lang } = useLanguage();
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data: qs } = await supabase
        .from("custom_questions")
        .select("*")
        .eq("is_active", true)
        .eq("step_number", stepNumber)
        .order("sort_order", { ascending: true });
      if (qs) setQuestions(qs as CustomQuestion[]);
    };
    fetchQuestions();
  }, [stepNumber]);

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
