import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/contexts/LanguageContext";

export interface FieldConfig {
  id: string;
  field_name: string;
  step_number: number;
  is_visible: boolean;
  is_required: boolean;
  label_ar: string | null;
  label_en: string | null;
  sort_order: number;
}

let cachedConfig: FieldConfig[] | null = null;

export const fetchFieldConfig = async (): Promise<FieldConfig[]> => {
  if (cachedConfig) return cachedConfig;
  const { data } = await supabase
    .from("form_field_config")
    .select("*")
    .order("step_number", { ascending: true })
    .order("sort_order", { ascending: true });
  cachedConfig = (data as FieldConfig[]) || [];
  return cachedConfig;
};

export const invalidateFieldConfigCache = () => { cachedConfig = null; };

export const useFieldConfig = () => {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchFieldConfig().then((f) => { setFields(f); setLoaded(true); });
  }, []);

  const isVisible = (fieldName: string): boolean => {
    const f = fields.find(c => c.field_name === fieldName);
    return f ? f.is_visible : true; // default visible if not in DB
  };

  const isRequired = (fieldName: string): boolean => {
    const f = fields.find(c => c.field_name === fieldName);
    return f ? f.is_required : false;
  };

  const getLabel = (fieldName: string, lang: Lang, fallback: string): string => {
    const f = fields.find(c => c.field_name === fieldName);
    if (!f) return fallback;
    const label = lang === "ar" ? f.label_ar : f.label_en;
    return label || fallback;
  };

  const getVisibleFields = (stepNumber: number): FieldConfig[] => {
    return fields.filter(f => f.step_number === stepNumber && f.is_visible);
  };

  const getRequiredFields = (stepNumber: number): string[] => {
    return fields
      .filter(f => f.step_number === stepNumber && f.is_visible && f.is_required)
      .map(f => f.field_name);
  };

  return { fields, loaded, isVisible, isRequired, getLabel, getVisibleFields, getRequiredFields };
};
