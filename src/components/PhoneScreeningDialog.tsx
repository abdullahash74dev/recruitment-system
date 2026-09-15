import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  MessageCircle,
  Timer,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  MinusCircle,
  History,
} from "lucide-react";
import {
  usePhoneScreeningSettingsQuery,
  usePhoneScreeningQuestionsQuery,
  usePhoneScreeningsForApplicantQuery,
  useCreatePhoneScreeningMutation,
  type AnswerResult,
  type ScreeningDecision,
} from "@/hooks/queries/usePhoneScreening";
import { useRejectionReasonsQuery } from "@/hooks/queries/useRejectionReasons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicantId: string;
  applicantName: string;
  applicantPhone?: string | null;
  /** Omit for the internal HR/admin scope; pass the caller's org id from the client portal. */
  clientOrganizationId?: string;
}

type Phase = "idle" | "running" | "review";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function PhoneScreeningDialog({ open, onOpenChange, applicantId, applicantName, applicantPhone, clientOrganizationId }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: settings } = usePhoneScreeningSettingsQuery(clientOrganizationId);
  const { data: questions = [] } = usePhoneScreeningQuestionsQuery(clientOrganizationId);
  const { data: history = [] } = usePhoneScreeningsForApplicantQuery(open ? applicantId : undefined, clientOrganizationId);
  const { data: reasons = [] } = useRejectionReasonsQuery();
  const createScreening = useCreatePhoneScreeningMutation(lang);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [decision, setDecision] = useState<ScreeningDecision>("pending");
  const [rejectionReasonId, setRejectionReasonId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minDuration = settings?.min_duration_seconds ?? 60;
  const initialMax = settings?.initial_max_duration_seconds ?? 180;
  const extendedMax = settings?.extended_max_duration_seconds ?? 600;
  const cap = extended ? extendedMax : initialMax;

  const activeReasons = useMemo(() => reasons.filter((r) => r.is_active), [reasons]);

  const allPassed = questions.length > 0 && questions.every((q) => results[q.id] === "passed");

  useEffect(() => {
    if (allPassed && !extended) {
      setExtended(true);
      import("sonner").then(({ toast }) =>
        toast.success(ar ? "مرشح متميز — تم تمديد المكالمة إلى 10 دقائق" : "Outstanding candidate — call extended to 10 minutes")
      );
    }
  }, [allPassed, extended, ar]);

  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [phase]);

  // Reset all local state whenever the dialog is opened for a (possibly different) applicant.
  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setElapsed(0);
    setStartedAt(null);
    setEndedAt(null);
    setExtended(false);
    setResults({});
    setDecision("pending");
    setRejectionReasonId("");
    setNotes("");
  }, [open, applicantId]);

  const startCall = () => {
    setStartedAt(new Date().toISOString());
    setPhase("running");
  };

  const endCall = () => {
    setEndedAt(new Date().toISOString());
    setPhase("review");
  };

  const save = () => {
    if (!startedAt || !endedAt) return;
    createScreening.mutate(
      {
        applicantId,
        clientOrganizationId,
        startedAt,
        endedAt,
        durationSeconds: elapsed,
        wasExtended: extended,
        decision,
        rejectionReasonId: decision === "rejected" ? rejectionReasonId || null : null,
        notes,
        answers: questions.map((q) => ({
          questionId: q.id,
          questionSnapshot: ar ? q.question_ar : q.question_en || q.question_ar,
          result: results[q.id] ?? "skipped",
        })),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const progressPct = Math.min(100, (elapsed / cap) * 100);
  const pastMin = elapsed >= minDuration;
  const timerColor = elapsed >= cap ? "text-destructive" : pastMin ? "text-emerald-600" : "text-muted-foreground";

  const phoneDigits = applicantPhone ? digitsOnly(applicantPhone) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            {ar ? "تقييم مكالمة هاتفية" : "Phone Screening"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold">{applicantName}</p>
              {applicantPhone && <p className="text-sm text-muted-foreground" dir="ltr">{applicantPhone}</p>}
            </div>
            {applicantPhone && (
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={`tel:${phoneDigits}`}>
                    <Phone className="w-3.5 h-3.5" />
                    {ar ? "اتصال" : "Call"}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {ar ? "واتساب" : "WhatsApp"}
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className={`w-5 h-5 ${timerColor}`} />
                <span className={`text-3xl font-black tabular-nums ${timerColor}`}>{formatClock(elapsed)}</span>
                <span className="text-xs text-muted-foreground">/ {formatClock(cap)}</span>
              </div>
              {extended && (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <Sparkles className="w-3 h-3" />
                  {ar ? "تم التمديد" : "Extended"}
                </Badge>
              )}
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {phase === "idle" && (ar ? `اضغط "بدء المكالمة" بعد ما تتصل بالمرشح فعلياً.` : `Press "Start call" once you've actually dialed the candidate.`)}
              {phase === "running" && !pastMin && (ar ? `الحد الأدنى للتقييم: ${formatClock(minDuration)}` : `Minimum for a fair read: ${formatClock(minDuration)}`)}
              {phase === "running" && pastMin && elapsed < cap && (ar ? "بإمكانك إنهاء المكالمة الآن، أو كمّل إذا لسا بحاجة وقت." : "You can end now, or keep going if you need more time.")}
              {phase === "running" && elapsed >= cap && (ar ? "تجاوزت السقف المحدد — أنهِ المكالمة." : "You've hit the time cap — wrap up the call.")}
            </p>
            {phase === "idle" && (
              <Button onClick={startCall} className="w-full gap-2">
                <PhoneCall className="w-4 h-4" />
                {ar ? "بدء المكالمة" : "Start call"}
              </Button>
            )}
            {phase === "running" && (
              <Button onClick={endCall} variant="destructive" className="w-full gap-2">
                <PhoneOff className="w-4 h-4" />
                {ar ? "إنهاء المكالمة" : "End call"}
              </Button>
            )}
            {phase === "running" && !extended && (
              <Button onClick={() => setExtended(true)} variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                {ar ? "تمديد يدوي إلى 10 دقائق" : "Manually extend to 10 minutes"}
              </Button>
            )}
          </div>

          {/* Question checklist */}
          {(phase === "running" || phase === "review") && questions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{ar ? "الأسئلة المحورية" : "Key questions"}</p>
              {questions.map((q) => {
                const result = results[q.id] ?? "skipped";
                const hasHint = ar ? q.expected_answer_ar : q.expected_answer_en;
                return (
                  <div key={q.id} className="rounded-lg border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm flex-1">{ar ? q.question_ar : q.question_en || q.question_ar}</p>
                      {hasHint && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{hasHint}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={result === "passed" ? "default" : "outline"}
                        className={`h-7 px-2 gap-1 text-xs ${result === "passed" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                        onClick={() => setResults((r) => ({ ...r, [q.id]: "passed" }))}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {ar ? "جاز" : "Passed"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={result === "failed" ? "destructive" : "outline"}
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => setResults((r) => ({ ...r, [q.id]: "failed" }))}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {ar ? "لم يجز" : "Failed"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={result === "skipped" ? "secondary" : "outline"}
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => setResults((r) => ({ ...r, [q.id]: "skipped" }))}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        {ar ? "تخطّي" : "Skip"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Decision + save */}
          {phase === "review" && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">{ar ? "قرار التقييم" : "Screening decision"}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={decision === "passed" ? "default" : "outline"}
                  className={`flex-1 gap-1.5 ${decision === "passed" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  onClick={() => setDecision("passed")}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {ar ? "نجح" : "Passed"}
                </Button>
                <Button
                  type="button"
                  variant={decision === "rejected" ? "destructive" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setDecision("rejected")}
                >
                  <XCircle className="w-4 h-4" />
                  {ar ? "رفض" : "Rejected"}
                </Button>
              </div>
              {decision === "rejected" && (
                <Select value={rejectionReasonId} onValueChange={setRejectionReasonId}>
                  <SelectTrigger><SelectValue placeholder={ar ? "سبب الرفض (اختياري)" : "Rejection reason (optional)"} /></SelectTrigger>
                  <SelectContent>
                    {activeReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{ar ? r.reason_ar : r.reason_en || r.reason_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={ar ? "ملاحظات عامة على المكالمة (اختياري)" : "General notes on the call (optional)"}
                className="min-h-[70px] text-sm"
              />
              <Button onClick={save} disabled={createScreening.isPending} className="w-full">
                {createScreening.isPending ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ النتيجة" : "Save result")}
              </Button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  {ar ? "تقييمات سابقة" : "Past screenings"}
                </p>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1.5 pe-2">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs rounded border p-2">
                        <span className="text-muted-foreground">
                          {new Date(h.created_at).toLocaleString(ar ? "ar-SA" : "en-US")} • {formatClock(h.duration_seconds ?? 0)}
                          {h.performed_by_name ? ` • ${h.performed_by_name}` : ""}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            h.decision === "passed"
                              ? "border-emerald-600/40 text-emerald-600"
                              : h.decision === "rejected"
                                ? "border-destructive/40 text-destructive"
                                : ""
                          }
                        >
                          {h.decision === "passed" ? (ar ? "نجح" : "Passed") : h.decision === "rejected" ? (ar ? "رفض" : "Rejected") : (ar ? "معلّق" : "Pending")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
