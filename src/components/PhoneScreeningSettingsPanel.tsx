import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, Save, Plus, Trash2, Sparkles, GripVertical } from "lucide-react";
import {
  usePhoneScreeningSettingsQuery,
  useSavePhoneScreeningSettingsMutation,
  usePhoneScreeningQuestionsQuery,
  useCreatePhoneScreeningQuestionMutation,
  useUpdatePhoneScreeningQuestionMutation,
  useDeletePhoneScreeningQuestionMutation,
  useSeedDefaultQuestionsMutation,
} from "@/hooks/queries/usePhoneScreening";

interface Props {
  /** Omit for the internal HR/admin scope; pass the org id from the client portal. */
  clientOrganizationId?: string;
}

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m} د` : `${m}:${String(s).padStart(2, "0")}`;
}

export default function PhoneScreeningSettingsPanel({ clientOrganizationId }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: settings } = usePhoneScreeningSettingsQuery(clientOrganizationId);
  const saveSettings = useSavePhoneScreeningSettingsMutation(clientOrganizationId, lang);
  const { data: questions = [] } = usePhoneScreeningQuestionsQuery(clientOrganizationId, false);
  const createQuestion = useCreatePhoneScreeningQuestionMutation(clientOrganizationId, lang);
  const updateQuestion = useUpdatePhoneScreeningQuestionMutation(clientOrganizationId, lang);
  const deleteQuestion = useDeletePhoneScreeningQuestionMutation(clientOrganizationId, lang);
  const seedDefaults = useSeedDefaultQuestionsMutation(clientOrganizationId ?? "", lang);

  const [minDuration, setMinDuration] = useState(60);
  const [initialMax, setInitialMax] = useState(180);
  const [extendedMax, setExtendedMax] = useState(600);

  useEffect(() => {
    if (!settings) return;
    setMinDuration(settings.min_duration_seconds);
    setInitialMax(settings.initial_max_duration_seconds);
    setExtendedMax(settings.extended_max_duration_seconds);
  }, [settings]);

  const [newQuestion, setNewQuestion] = useState({ question_ar: "", question_en: "", expected_answer_ar: "", expected_answer_en: "" });

  const addQuestion = () => {
    if (!newQuestion.question_ar.trim()) return;
    createQuestion.mutate(
      { ...newQuestion, display_order: questions.length },
      { onSuccess: () => setNewQuestion({ question_ar: "", question_en: "", expected_answer_ar: "", expected_answer_en: "" }) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PhoneCall className="w-5 h-5" />
        <h3 className="text-lg font-bold">{ar ? "إعدادات تقييم المكالمات الهاتفية" : "Phone Screening Settings"}</h3>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{ar ? "توقيت المكالمة" : "Call timing"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs">{ar ? "الحد الأدنى المقترح" : "Suggested minimum"}: {mmss(minDuration)}</Label>
            <Slider value={[minDuration]} min={15} max={180} step={15} onValueChange={([v]) => setMinDuration(v)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{ar ? "المدة الأولية (قبل التمديد)" : "Initial cap (before extension)"}: {mmss(initialMax)}</Label>
            <Slider value={[initialMax]} min={minDuration} max={600} step={15} onValueChange={([v]) => setInitialMax(Math.max(v, minDuration))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {ar ? "المدة الموسّعة (للمرشح المتميز)" : "Extended cap (for a standout candidate)"}: {mmss(extendedMax)}
            </Label>
            <Slider value={[extendedMax]} min={initialMax} max={900} step={30} onValueChange={([v]) => setExtendedMax(Math.max(v, initialMax))} />
          </div>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "لما يعلّم المُقيِّم كل الأسئلة \"جاز\"، تمتد المكالمة تلقائياً للمدة الموسّعة."
              : "When every question is marked \"Passed\", the call automatically extends to the extended cap."}
          </p>
          <Button
            size="sm"
            onClick={() => saveSettings.mutate({ min_duration_seconds: minDuration, initial_max_duration_seconds: initialMax, extended_max_duration_seconds: extendedMax })}
            disabled={saveSettings.isPending}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {ar ? "حفظ التوقيت" : "Save timing"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{ar ? "الأسئلة المحورية" : "Key questions"}</CardTitle>
            {clientOrganizationId && questions.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending} className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {ar ? "استيراد أسئلة افتراضية" : "Import default questions"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={q.question_ar}
                    dir="rtl"
                    placeholder={ar ? "السؤال (عربي)" : "Question (Arabic)"}
                    onChange={(e) => updateQuestion.mutate({ id: q.id, patch: { question_ar: e.target.value } })}
                  />
                  <Input
                    value={q.question_en || ""}
                    dir="ltr"
                    placeholder={ar ? "السؤال (إنجليزي - اختياري)" : "Question (English - optional)"}
                    onChange={(e) => updateQuestion.mutate({ id: q.id, patch: { question_en: e.target.value } })}
                  />
                  <Textarea
                    value={q.expected_answer_ar || ""}
                    dir="rtl"
                    placeholder={ar ? "الإجابة المتوقعة (عربي)" : "Expected answer (Arabic)"}
                    className="min-h-[50px] text-xs"
                    onChange={(e) => updateQuestion.mutate({ id: q.id, patch: { expected_answer_ar: e.target.value } })}
                  />
                  <Textarea
                    value={q.expected_answer_en || ""}
                    dir="ltr"
                    placeholder={ar ? "الإجابة المتوقعة (إنجليزي - اختياري)" : "Expected answer (English - optional)"}
                    className="min-h-[50px] text-xs"
                    onChange={(e) => updateQuestion.mutate({ id: q.id, patch: { expected_answer_en: e.target.value } })}
                  />
                </div>
                <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => deleteQuestion.mutate(q.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {!q.is_active && <Badge variant="outline">{ar ? "غير مفعّل" : "Inactive"}</Badge>}
            </div>
          ))}

          <Separator />

          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{ar ? "إضافة سؤال جديد" : "Add a new question"}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input value={newQuestion.question_ar} dir="rtl" placeholder={ar ? "السؤال (عربي)" : "Question (Arabic)"} onChange={(e) => setNewQuestion((n) => ({ ...n, question_ar: e.target.value }))} />
              <Input value={newQuestion.question_en} dir="ltr" placeholder={ar ? "السؤال (إنجليزي - اختياري)" : "Question (English - optional)"} onChange={(e) => setNewQuestion((n) => ({ ...n, question_en: e.target.value }))} />
              <Textarea value={newQuestion.expected_answer_ar} dir="rtl" placeholder={ar ? "الإجابة المتوقعة (عربي)" : "Expected answer (Arabic)"} className="min-h-[50px] text-xs" onChange={(e) => setNewQuestion((n) => ({ ...n, expected_answer_ar: e.target.value }))} />
              <Textarea value={newQuestion.expected_answer_en} dir="ltr" placeholder={ar ? "الإجابة المتوقعة (إنجليزي - اختياري)" : "Expected answer (English - optional)"} className="min-h-[50px] text-xs" onChange={(e) => setNewQuestion((n) => ({ ...n, expected_answer_en: e.target.value }))} />
            </div>
            <Button size="sm" onClick={addQuestion} disabled={createQuestion.isPending || !newQuestion.question_ar.trim()} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {ar ? "إضافة السؤال" : "Add question"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
